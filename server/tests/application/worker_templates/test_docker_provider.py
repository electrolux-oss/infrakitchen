import json
from datetime import UTC, datetime

import httpx
import pytest
from pydantic import ValidationError

import application.worker_templates.providers.docker as docker_mod
from application.worker_templates.model import WorkerTemplateDTO
from application.worker_templates.providers import get_worker_provider
from application.worker_templates.providers.base import MANAGED_BY_LABEL, TEMPLATE_LABEL, WorkerInstance
from application.worker_templates.providers.docker import (
    DockerUnavailable,
    DockerWorkerProvider,
    OwnContainer,
    build_container,
    container_to_instance,
    get_own_container,
)
from application.worker_templates.schema import DockerWorkerConfig, parse_memory
from core.tools.docker_client import DockerClient, DockerError, split_image


class FakeDocker:
    """Routes httpx requests to canned Docker Engine API answers and records them."""

    def __init__(self):
        self.requests: list[httpx.Request] = []
        self.routes: dict[tuple[str, str], httpx.Response] = {}

    def on(self, method: str, path: str, status: int = 200, body=None):
        self.routes[(method, path)] = httpx.Response(status, json=body)

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        response = self.routes.get((request.method, request.url.path))
        if response is None:
            return httpx.Response(404, json={"message": f"no route {request.method} {request.url.path}"})
        return response

    def calls(self, method: str | None = None) -> list[tuple[str, str]]:
        return [(r.method, r.url.path) for r in self.requests if method is None or r.method == method]


@pytest.fixture
def fake_docker(monkeypatch):
    fake = FakeDocker()
    transport = httpx.MockTransport(fake.handler)

    def transport_and_base_url(_host):
        return transport, "http://docker"

    monkeypatch.setattr("core.tools.docker_client._transport_and_base_url", transport_and_base_url)
    docker_mod._own_containers.clear()
    yield fake
    docker_mod._own_containers.clear()


@pytest.fixture
def template(mocked_worker_template) -> WorkerTemplateDTO:
    mocked_worker_template.provider = "docker"
    mocked_worker_template.name = "Big Workers!"
    mocked_worker_template.configuration = {
        "provider": "docker",
        "image": "ik:1.0",
        "network": "iknet",
        "env": {"EXTRA": "1", "POSTGRES_HOST": "db-override"},
        "volumes": ["/data:/data:ro"],
        "memory": "2g",
        "cpus": 1.5,
    }
    return WorkerTemplateDTO.model_validate(mocked_worker_template)


class TestConfig:
    def test_defaults(self):
        config = DockerWorkerConfig()
        assert config.docker_host == "unix:///var/run/docker.sock"
        assert config.command == ["/app/.venv/bin/python", "worker.py"]

    @pytest.mark.parametrize(
        "data",
        [
            {"docker_host": "ssh://host"},
            {"memory": "lots"},
            {"volumes": ["/only-one-part"]},
            {"command": []},
            {"cpus": 0},
        ],
    )
    def test_invalid(self, data):
        with pytest.raises(ValidationError):
            _ = DockerWorkerConfig.model_validate(data)

    @pytest.mark.parametrize("value, expected", [("512m", 512 * 1024**2), ("2g", 2 * 1024**3), ("1024", 1024)])
    def test_parse_memory(self, value, expected):
        assert parse_memory(value) == expected

    def test_provider_lookup(self, template):
        assert isinstance(get_worker_provider(template), DockerWorkerProvider)

    @pytest.mark.parametrize(
        "image, expected",
        [
            ("ik", ("ik", "latest")),
            ("ik:1.0", ("ik", "1.0")),
            ("registry:5000/team/ik", ("registry:5000/team/ik", "latest")),
            ("registry:5000/team/ik:2", ("registry:5000/team/ik", "2")),
            ("ik@sha256:abc", ("ik@sha256:abc", None)),
        ],
    )
    def test_split_image(self, image, expected):
        assert split_image(image) == expected


class TestBuildContainer:
    def test_body(self, template):
        own = OwnContainer(image="ik:own", env={"POSTGRES_HOST": "db", "JWT_KEY": "k"}, network="ownnet")

        body = build_container(template, template.configuration, "ik-worker-x", {"WORKER_NAME": "w"}, own)

        assert body["Image"] == "ik:1.0"
        assert body["Hostname"] == "ik-worker-x"
        assert body["Cmd"] == ["/app/.venv/bin/python", "worker.py"]
        assert sorted(body["Env"]) == ["EXTRA=1", "JWT_KEY=k", "POSTGRES_HOST=db-override", "WORKER_NAME=w"]
        assert body["Labels"] == {MANAGED_BY_LABEL: "infrakitchen", TEMPLATE_LABEL: str(template.id)}
        host_config = body["HostConfig"]
        assert host_config["RestartPolicy"] == {"Name": "no"}
        assert host_config["NetworkMode"] == "iknet"
        assert host_config["Binds"] == ["/data:/data:ro"]
        assert host_config["Memory"] == 2 * 1024**3
        assert host_config["NanoCpus"] == 1_500_000_000

    def test_inherits_image_and_network(self, template):
        config = DockerWorkerConfig()
        own = OwnContainer(image="ik:own", network="ownnet")

        body = build_container(template, config, "n", {}, own)

        assert body["Image"] == "ik:own"
        assert body["HostConfig"]["NetworkMode"] == "ownnet"

    def test_image_required_outside_a_container(self, template):
        with pytest.raises(DockerUnavailable, match="Set an image"):
            _ = build_container(template, DockerWorkerConfig(), "n", {}, OwnContainer())


class TestContainerToInstance:
    @pytest.mark.parametrize(
        "state, expected",
        [("created", "pending"), ("running", "running"), ("restarting", "running"), ("removing", "succeeded")],
    )
    def test_phase_mapping(self, state, expected):
        instance = container_to_instance({"Id": "abc", "Names": ["/ik-worker-a"], "State": state, "Created": 0})
        assert instance.phase == expected
        assert instance.host == "ik-worker-a"
        assert instance.created_at == datetime(1970, 1, 1, tzinfo=UTC)

    def test_exited_ok_is_succeeded(self):
        details = {"State": {"ExitCode": 0, "FinishedAt": "2026-01-01T10:00:00.123456789Z"}}
        instance = container_to_instance({"Id": "abc", "Names": ["/w"], "State": "exited"}, details)
        assert instance.phase == "succeeded"
        assert instance.finished_at == datetime(2026, 1, 1, 10, 0, 0, 123456, tzinfo=UTC)

    def test_exited_with_error_is_failed(self):
        details = {"State": {"ExitCode": 137, "OOMKilled": True, "FinishedAt": "0001-01-01T00:00:00Z"}}
        instance = container_to_instance({"Id": "abc", "Names": ["/w"], "State": "exited"}, details)
        assert instance.phase == "failed"
        assert instance.reason == "OOMKilled (exit code 137)"
        assert instance.finished_at is None


class TestOwnContainer:
    async def test_reads_own_container(self, fake_docker, monkeypatch):
        monkeypatch.setattr(docker_mod.socket, "gethostname", lambda: "abc123")
        fake_docker.on(
            "GET",
            "/containers/abc123/json",
            body={
                "Config": {
                    "Image": "ik:own",
                    "Env": ["PATH=/usr/bin", "POSTGRES_HOST=db", "WORKER_AUTOSCALER_INTERVAL_SECONDS=15", "A=b=c"],
                },
                "NetworkSettings": {"Networks": {"iknet": {}}},
            },
        )

        own = await get_own_container(DockerClient())

        assert own == OwnContainer(image="ik:own", env={"POSTGRES_HOST": "db", "A": "b=c"}, network="iknet")

    async def test_not_in_a_container(self, fake_docker):
        assert await get_own_container(DockerClient()) == OwnContainer()


class TestDockerWorkerProvider:
    async def test_spawn_creates_and_starts(self, fake_docker, template):
        fake_docker.on("POST", "/containers/create", 201, {"Id": "cid"})
        fake_docker.on("POST", "/containers/cid/start", 204)

        instance = await DockerWorkerProvider(template).spawn({"WORKER_NAME": "w"})

        assert instance.id.startswith("ik-worker-big-workers-")
        assert instance.details["container_id"] == "cid"
        create = next(r for r in fake_docker.requests if r.url.path == "/containers/create")
        assert create.url.params["name"] == instance.id
        assert json.loads(create.content)["Hostname"] == instance.id

    async def test_failed_start_removes_container(self, fake_docker, template):
        fake_docker.on("POST", "/containers/create", 201, {"Id": "cid"})
        fake_docker.on("POST", "/containers/cid/start", 500, {"message": "port is already allocated"})
        fake_docker.on("DELETE", "/containers/cid", 204)

        with pytest.raises(DockerError, match="port is already allocated"):
            _ = await DockerWorkerProvider(template).spawn({})

        assert ("DELETE", "/containers/cid") in fake_docker.calls()

    async def test_missing_image_is_pulled(self, fake_docker, template):
        fake_docker.on("POST", "/containers/create", 404, {"message": "No such image: ik:1.0"})
        fake_docker.on("POST", "/images/create", 200)

        with pytest.raises(DockerError):
            # The fake keeps answering 404, but the pull must have been attempted in between
            _ = await DockerWorkerProvider(template).spawn({})

        assert fake_docker.calls("POST") == [
            ("POST", "/containers/create"),
            ("POST", "/images/create"),
            ("POST", "/containers/create"),
        ]

    async def test_list_filters_by_template_labels(self, fake_docker, template):
        fake_docker.on(
            "GET",
            "/containers/json",
            body=[
                {"Id": "a", "Names": ["/w-a"], "State": "running", "Created": 1},
                {"Id": "b", "Names": ["/w-b"], "State": "exited", "Created": 1},
            ],
        )
        fake_docker.on("GET", "/containers/b/json", body={"State": {"ExitCode": 1, "Error": ""}})

        instances = await DockerWorkerProvider(template).list_instances()

        assert [(i.id, i.phase) for i in instances] == [("w-a", "running"), ("w-b", "failed")]
        listing = fake_docker.requests[0]
        filters = json.loads(listing.url.params["filters"])
        assert sorted(filters["label"]) == sorted(
            [f"{MANAGED_BY_LABEL}=infrakitchen", f"{TEMPLATE_LABEL}={template.id}"]
        )

    async def test_delete_ignores_missing_container(self, fake_docker, template):
        instance = WorkerInstance(id="w", host="w", phase="succeeded", details={"container_id": "cid"})

        await DockerWorkerProvider(template).delete_instance(instance)

        assert fake_docker.calls() == [("DELETE", "/containers/cid")]

    async def test_validate_checks_network(self, fake_docker, template):
        fake_docker.on("GET", "/_ping", body="OK")
        fake_docker.on("GET", "/images/ik:1.0/json", body={})

        with pytest.raises(DockerUnavailable, match="Network 'iknet' not found"):
            await DockerWorkerProvider(template).validate()

    async def test_validate_unreachable_daemon(self, fake_docker, template):
        fake_docker.on("GET", "/_ping", 500, {"message": "down"})

        with pytest.raises(DockerUnavailable, match="answered with an error"):
            await DockerWorkerProvider(template).validate()


def test_decode_log_stream_framed():
    from core.tools.docker_client import decode_log_stream

    def frame(stream: int, text: bytes) -> bytes:
        return bytes([stream, 0, 0, 0]) + len(text).to_bytes(4, "big") + text

    content = frame(1, b"out line\n") + frame(2, b"err line\n")
    assert decode_log_stream(content) == "out line\nerr line\n"


def test_decode_log_stream_plain_tty():
    from core.tools.docker_client import decode_log_stream

    assert decode_log_stream(b"2026-01-01T00:00:00Z plain text line\n") == "2026-01-01T00:00:00Z plain text line\n"


def test_mask_env():
    from application.worker_templates.providers.base import mask_env

    assert mask_env(["POSTGRES_PASSWORD=secret", "JWT_KEY=abc", "WORKER_NAME=w", "NOVALUE"]) == [
        "POSTGRES_PASSWORD=********",
        "JWT_KEY=********",
        "WORKER_NAME=w",
        "NOVALUE",
    ]
