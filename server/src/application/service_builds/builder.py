import asyncio
import base64
from collections.abc import Awaitable
from dataclasses import dataclass, field
from datetime import datetime, UTC
import json
import logging
import os
import time
from typing import Any, cast
from uuid import UUID

import aiohttp
from kubernetes_asyncio import client, config
from kubernetes_asyncio.client import ApiException

from application.providers.worker_providers.kubernetes import FATAL_WAITING_REASONS, incluster_namespace
from core.config import Settings
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed

logger = logging.getLogger(__name__)

JOB_WORKSPACE = "/workspace"
BUILD_USER_ID = 1000
LOG_SAVE_SECONDS = 2
MAX_LOG_LINE_BYTES = 16384

CLONE_CONTAINER = "clone"
BUILD_CONTAINER = "build"
PUSH_CONTAINER = "push"
CONTAINERS = (CLONE_CONTAINER, BUILD_CONTAINER, PUSH_CONTAINER)

SECRETS_DIR = "/secrets"
OUTPUT_DIR = "/output"
OUTPUT_LAYOUT = f"{OUTPUT_DIR}/image"
OUTPUT_METADATA = f"{OUTPUT_DIR}/metadata.json"
BUILDKIT_STATE_DIR = "/home/user/.local/share/buildkit"

DIGEST_SED = r's/.*"containerimage.digest": *"\([^"]*\)".*/\1/p'

# The repository URL can carry an access token: it is fetched without saving a remote, and FETCH_HEAD
# and the reflogs that would record it are removed, so the token never reaches the build context
CLONE_SCRIPT = f"""\
set -eu
if [ -s {SECRETS_DIR}/ssh-key ]; then
  install -m 600 {SECRETS_DIR}/ssh-key /tmp/ssh-key
  export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no -i /tmp/ssh-key"
fi
git config --global --add safe.directory "$WORKSPACE"
git init -q "$WORKSPACE"
cd "$WORKSPACE"
url="$(cat {SECRETS_DIR}/git-url)"
git -c core.logAllRefUpdates=false fetch -q --depth 1 "$url" "$COMMIT_SHA" \
  || git -c core.logAllRefUpdates=false fetch -q "$url" "+refs/heads/*:refs/remotes/origin/*"
git -c advice.detachedHead=false checkout -q "$COMMIT_SHA"
rm -rf .git/FETCH_HEAD .git/logs
echo "Checked out $COMMIT_SHA"
"""

# Re-exports the image the build step wrote, from a Dockerfile that is only FROM it: the push step runs
# no code of the service, so the registry credentials are never in a container that runs the Dockerfile.
# Only the digest goes to the termination log, which is capped at 4 KB.
PUSH_SCRIPT = f"""\
set -eu
digest="$(sed -n '{DIGEST_SED}' {OUTPUT_METADATA})"
if [ -z "$digest" ]; then
  echo "The build step reported no image digest" >&2
  exit 1
fi
mkdir -p /tmp/push
echo "FROM built" > /tmp/push/Dockerfile
buildctl-daemonless.sh "$@" --opt "context:built=oci-layout://built@$digest" --metadata-file /tmp/metadata.json
sed -n '{DIGEST_SED}' /tmp/metadata.json > /dev/termination-log
"""


@dataclass(frozen=True)
class GitSource:
    url: str = field(repr=False)
    commit_sha: str
    ssh_private_key: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class RegistryLogin:
    registry: str
    username: str
    password: str = field(repr=False)


@dataclass(frozen=True)
class ImageBuildRequest:
    context_dir: str
    dockerfile: str
    images: tuple[str, ...]
    logins: tuple[RegistryLogin, ...] = field(repr=False)
    labels: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ImageBuildResult:
    digest: str


_configuration: client.Configuration | None = None


def incluster_configuration() -> client.Configuration:
    global _configuration
    if _configuration is None:
        configuration = client.Configuration()
        try:
            config.load_incluster_config(client_configuration=configuration)
        except config.ConfigException as e:
            raise CannotProceed(
                f"The worker is not running inside a Kubernetes cluster, cannot run image builds: {e}"
            ) from e
        _configuration = configuration
    return _configuration


def build_labels(build_id: UUID) -> dict[str, str]:
    return {"app.kubernetes.io/managed-by": "infrakitchen", "infrakitchen.io/service-build": str(build_id)}


def docker_config(logins: tuple[RegistryLogin, ...]) -> str:
    auths = {
        login.registry: {"auth": base64.b64encode(f"{login.username}:{login.password}".encode()).decode()}
        for login in logins
    }
    return json.dumps({"auths": auths})


def secret_data(source: GitSource, request: ImageBuildRequest) -> dict[str, str]:
    ssh_key = f"{source.ssh_private_key.strip()}\n" if source.ssh_private_key else ""
    return {
        "git-url": source.url,
        "ssh-key": ssh_key,
        "passwd": f"build:x:{BUILD_USER_ID}:{BUILD_USER_ID}::/tmp:/bin/sh\n",
        "config.json": docker_config(request.logins),
    }


def secret_manifest(name: str, build_id: UUID, job_uid: str, data: dict[str, str]) -> Any:
    return {
        "apiVersion": "v1",
        "kind": "Secret",
        "metadata": {
            "name": name,
            "labels": build_labels(build_id),
            "ownerReferences": [{"apiVersion": "batch/v1", "kind": "Job", "name": name, "uid": job_uid}],
        },
        "type": "Opaque",
        "stringData": data,
    }


def secret_volume(volume: str, secret: str, keys: list[str]) -> dict[str, Any]:
    return {
        "name": volume,
        "secret": {"secretName": secret, "defaultMode": 0o440, "items": [{"key": k, "path": k} for k in keys]},
    }


def scratch_volume(settings: Settings, volume: str) -> dict[str, Any]:
    return {"name": volume, "emptyDir": {"sizeLimit": settings.IMAGE_BUILD_STORAGE_LIMIT}}


def rootless_buildkit(settings: Settings) -> dict[str, Any]:
    return {
        "image": settings.IMAGE_BUILD_BUILDKIT_IMAGE,
        "securityContext": {
            "seccompProfile": {"type": "Unconfined"},
            "appArmorProfile": {"type": "Unconfined"},
        },
    }


def build_args(request: ImageBuildRequest) -> list[str]:
    dockerfile_dir, dockerfile_name = os.path.split(request.dockerfile)
    args = [
        "build",
        "--progress", "plain",
        "--frontend", "dockerfile.v0",
        "--local", f"context={request.context_dir}",
        "--local", f"dockerfile={dockerfile_dir}",
        "--opt", f"filename={dockerfile_name}",
        "--output", f"type=oci,dest={OUTPUT_LAYOUT},tar=false",
        "--metadata-file", OUTPUT_METADATA,
    ]  # fmt: skip
    for key, value in request.labels.items():
        args += ["--opt", f"label:{key}={value}"]
    return args


def push_args(request: ImageBuildRequest) -> list[str]:
    return [
        "build",
        "--progress", "plain",
        "--frontend", "dockerfile.v0",
        "--local", "context=/tmp/push",
        "--local", "dockerfile=/tmp/push",
        "--oci-layout", f"built={OUTPUT_LAYOUT}",
        # The output is parsed as CSV, so the comma separated names are quoted
        "--output", f'type=image,"name={",".join(request.images)}",push=true',
    ]  # fmt: skip


def clone_container(settings: Settings, source: GitSource) -> dict[str, Any]:
    return {
        "name": CLONE_CONTAINER,
        "image": settings.IMAGE_BUILD_GIT_IMAGE,
        "command": ["sh", "-c", CLONE_SCRIPT],
        "env": [
            {"name": "HOME", "value": "/tmp"},
            {"name": "WORKSPACE", "value": JOB_WORKSPACE},
            {"name": "COMMIT_SHA", "value": source.commit_sha},
        ],
        "volumeMounts": [
            {"name": "workspace", "mountPath": JOB_WORKSPACE},
            {"name": "git-secrets", "mountPath": SECRETS_DIR, "readOnly": True},
            # ssh refuses to run for a uid without a passwd entry, the git image only has root
            {"name": "git-secrets", "mountPath": "/etc/passwd", "subPath": "passwd", "readOnly": True},
        ],
    }


def build_container(settings: Settings, request: ImageBuildRequest) -> dict[str, Any]:
    return {
        **rootless_buildkit(settings),
        "name": BUILD_CONTAINER,
        "command": ["buildctl-daemonless.sh"],
        "args": build_args(request),
        "env": [
            # Required for rootless BuildKit in an unprivileged pod
            {"name": "BUILDKITD_FLAGS", "value": "--oci-worker-no-process-sandbox"},
        ],
        "resources": {
            "requests": {"cpu": "1", "memory": "2Gi"},
            "limits": {"cpu": "2", "memory": "4Gi"},
        },
        "volumeMounts": [
            {"name": "workspace", "mountPath": JOB_WORKSPACE, "readOnly": True},
            {"name": "output", "mountPath": OUTPUT_DIR},
            {"name": "build-state", "mountPath": BUILDKIT_STATE_DIR},
        ],
    }


def push_container(settings: Settings, request: ImageBuildRequest) -> dict[str, Any]:
    return {
        **rootless_buildkit(settings),
        "name": PUSH_CONTAINER,
        "command": ["sh", "-c", PUSH_SCRIPT, "buildctl"],
        "args": push_args(request),
        "env": [
            {"name": "BUILDKITD_FLAGS", "value": "--oci-worker-no-process-sandbox"},
            {"name": "DOCKER_CONFIG", "value": SECRETS_DIR},
        ],
        "resources": {
            "requests": {"cpu": "250m", "memory": "256Mi"},
            "limits": {"cpu": "1", "memory": "1Gi"},
        },
        "volumeMounts": [
            {"name": "output", "mountPath": OUTPUT_DIR},
            {"name": "registry-secrets", "mountPath": SECRETS_DIR, "readOnly": True},
            {"name": "push-state", "mountPath": BUILDKIT_STATE_DIR},
        ],
    }


def job_manifest(settings: Settings, name: str, build_id: UUID, source: GitSource, request: ImageBuildRequest) -> Any:
    labels = build_labels(build_id)
    return {
        "apiVersion": "batch/v1",
        "kind": "Job",
        "metadata": {"name": name, "labels": labels},
        "spec": {
            "backoffLimit": 0,
            "activeDeadlineSeconds": settings.IMAGE_BUILD_TIMEOUT_SECONDS,
            "ttlSecondsAfterFinished": settings.IMAGE_BUILD_FAILED_RETENTION_SECONDS,
            "template": {
                "metadata": {"labels": labels},
                "spec": {
                    "restartPolicy": "Never",
                    "automountServiceAccountToken": False,
                    "enableServiceLinks": False,
                    "securityContext": {
                        "runAsNonRoot": True,
                        "runAsUser": BUILD_USER_ID,
                        "runAsGroup": BUILD_USER_ID,
                        "fsGroup": BUILD_USER_ID,
                    },
                    "initContainers": [clone_container(settings, source), build_container(settings, request)],
                    "containers": [push_container(settings, request)],
                    "volumes": [
                        scratch_volume(settings, "workspace"),
                        scratch_volume(settings, "output"),
                        scratch_volume(settings, "build-state"),
                        scratch_volume(settings, "push-state"),
                        secret_volume("git-secrets", name, ["git-url", "ssh-key", "passwd"]),
                        secret_volume("registry-secrets", name, ["config.json"]),
                    ],
                },
            },
        },
    }


def end_conditions(job: Any) -> dict[str, Any]:
    return {c.type: c for c in job.status.conditions or [] if c.status == "True" and c.type in ("Complete", "Failed")}


def container_statuses(pod: Any) -> list[Any]:
    if not pod or not pod.status:
        return []
    return [*(pod.status.init_container_statuses or []), *(pod.status.container_statuses or [])]


def has_started(status: Any) -> bool:
    return bool(status.state and (status.state.running or status.state.terminated))


def started_containers(pod: Any) -> list[str]:
    started = {status.name for status in container_statuses(pod) if has_started(status)}
    return [container for container in CONTAINERS if container in started]


def start_problem(job: Any, pod: Any, timeout: int) -> str | None:
    statuses = container_statuses(pod)
    for status in statuses:
        waiting = status.state.waiting if status.state else None
        if waiting and waiting.reason in FATAL_WAITING_REASONS:
            message = f": {waiting.message}" if waiting.message else ""
            return f"Build container {status.name} cannot start: {waiting.reason}{message}"
    if any(has_started(status) for status in statuses):
        return None

    created_at = job.metadata.creation_timestamp
    if created_at is None or (datetime.now(UTC) - created_at).total_seconds() < timeout:
        return None
    if pod is None:
        return f"No build pod was created within {timeout} seconds"
    unscheduled = next(
        (c for c in pod.status.conditions or [] if c.type == "PodScheduled" and c.status == "False"), None
    )
    reason = f": {unscheduled.message}" if unscheduled and unscheduled.message else ""
    return f"The build pod did not start within {timeout} seconds{reason}"


def pushed_digest(pod: Any) -> str:
    for status in container_statuses(pod):
        terminated = status.state.terminated if status.state else None
        if status.name == PUSH_CONTAINER and terminated and terminated.message:
            digest = terminated.message.strip()
            if digest.startswith("sha256:"):
                return digest
    raise ValueError("The Job finished without reporting the pushed image digest")


async def delete_ignoring_missing(what: str, delete: Awaitable[Any]) -> None:
    try:
        _ = await delete
    except ApiException as e:
        if e.status != 404:
            logger.warning(f"Could not delete {what}: {e.reason}")


class KubernetesJobBuilder:
    def __init__(self, settings: Settings) -> None:
        self.settings: Settings = settings

    @staticmethod
    def job_name(build_id: UUID) -> str:
        return f"ik-build-{build_id}"

    @property
    def namespace(self) -> str:
        return self.settings.IMAGE_BUILD_NAMESPACE or incluster_namespace()

    async def start(self, build_id: UUID, source: GitSource, request: ImageBuildRequest, logger: EntityLogger) -> None:
        name = self.job_name(build_id)
        namespace = self.namespace
        async with client.ApiClient(incluster_configuration()) as api:
            batch = client.BatchV1Api(api)
            try:
                job = await batch.create_namespaced_job(
                    namespace, job_manifest(self.settings, name, build_id, source, request)
                )
            except ApiException as e:
                if e.status != 409:
                    raise
                job = await batch.read_namespaced_job(name, namespace)

            secret = secret_manifest(name, build_id, job.metadata.uid, secret_data(source, request))
            try:
                _ = await client.CoreV1Api(api).create_namespaced_secret(namespace, secret)
            except ApiException as e:
                if e.status != 409:
                    await self._delete_job(batch, name, namespace)
                    raise
            except (TimeoutError, aiohttp.ClientError):
                await self._delete_job(batch, name, namespace)
                raise
        logger.info(f"Started build Job {namespace}/{name}")

    async def stop(self, build_id: UUID, logger: EntityLogger) -> None:
        """Delete the build Job unless it has ended, so a build marked failed cannot push afterwards."""
        name = self.job_name(build_id)
        namespace = self.namespace
        try:
            async with client.ApiClient(incluster_configuration()) as api:
                batch = client.BatchV1Api(api)
                try:
                    job = await batch.read_namespaced_job(name, namespace)
                except ApiException as e:
                    if e.status == 404:
                        return
                    raise
                if not end_conditions(job):
                    await self._delete_job(batch, name, namespace)
                    logger.warning(f"Stopped build Job {namespace}/{name}")
        except (TimeoutError, ApiException, aiohttp.ClientError, CannotProceed) as e:
            logger.warning(f"Could not stop build Job {namespace}/{name}: {e}")

    async def wait(self, build_id: UUID, logger: EntityLogger) -> ImageBuildResult:
        name = self.job_name(build_id)
        namespace = self.namespace
        async with client.ApiClient(incluster_configuration()) as api:
            batch = client.BatchV1Api(api)
            core = client.CoreV1Api(api)
            ended, pod = await self._follow(batch, core, name, namespace, logger)

            if "Failed" in ended:
                await delete_ignoring_missing(
                    f"build Secret {namespace}/{name}", core.delete_namespaced_secret(name, namespace)
                )
                failed = ended["Failed"]
                minutes = self.settings.IMAGE_BUILD_FAILED_RETENTION_SECONDS // 60
                raise ValueError(
                    f"The build Job failed: {failed.reason or ''} {failed.message or ''}".strip()
                    + f". Job {namespace}/{name} is kept for {minutes} minutes"
                )
            try:
                return ImageBuildResult(digest=pushed_digest(pod))
            finally:
                await self._delete_job(batch, name, namespace)

    async def _follow(
        self, batch: client.BatchV1Api, core: client.CoreV1Api, name: str, namespace: str, logger: EntityLogger
    ) -> tuple[dict[str, Any], Any]:
        streamed: set[str] = set()
        unreachable_since: float | None = None
        timeout = self.settings.IMAGE_BUILD_START_TIMEOUT_SECONDS
        while True:
            read = await self._read(batch, core, name, namespace)
            if isinstance(read, str):
                unreachable_since = unreachable_since or time.monotonic()
                if time.monotonic() - unreachable_since > timeout:
                    raise ValueError(f"Could not read build Job {namespace}/{name} for {timeout} seconds: {read}")
                logger.warning(f"Could not read build Job {namespace}/{name}: {read}")
                await asyncio.sleep(self.settings.IMAGE_BUILD_POLL_SECONDS)
                continue
            unreachable_since = None
            job, pod = read

            ended = end_conditions(job)
            if ended:
                break
            problem = start_problem(job, pod, timeout)
            if problem is not None:
                await self._delete_job(batch, name, namespace)
                raise ValueError(problem)

            container = next((c for c in started_containers(pod) if c not in streamed), None)
            if container is None:
                await asyncio.sleep(self.settings.IMAGE_BUILD_POLL_SECONDS)
                continue
            streamed.add(container)
            await self._stream_log(core, pod, namespace, container, logger)

        for container in started_containers(pod):
            if container not in streamed:
                await self._stream_log(core, pod, namespace, container, logger)
        return ended, pod

    async def _read(
        self, batch: client.BatchV1Api, core: client.CoreV1Api, name: str, namespace: str
    ) -> tuple[Any, Any] | str:
        try:
            return await batch.read_namespaced_job(name, namespace), await self._job_pod(core, name, namespace)
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"The build Job {namespace}/{name} no longer exists") from e
            return str(e.reason or e.status)
        except (TimeoutError, aiohttp.ClientError) as e:
            return str(e) or type(e).__name__

    @staticmethod
    async def _job_pod(core: client.CoreV1Api, name: str, namespace: str) -> Any:
        pods = await core.list_namespaced_pod(namespace, label_selector=f"job-name={name}")
        return pods.items[-1] if pods.items else None

    @staticmethod
    async def _stream_log(
        core: client.CoreV1Api, pod: Any, namespace: str, container: str, logger: EntityLogger
    ) -> None:
        try:
            response = await cast(Any, core).read_namespaced_pod_log(
                pod.metadata.name, namespace, container=container, follow=True, _preload_content=False
            )
        except ApiException as e:
            logger.warning(f"Could not read the {container} log: {e.reason}")
            return
        saved_at = time.monotonic()
        pending = b""
        try:
            # Read in chunks: iterating lines fails on a line longer than aiohttp's line limit
            async for chunk in response.content.iter_any():
                *lines, pending = (pending + chunk).split(b"\n")
                if len(pending) > MAX_LOG_LINE_BYTES:
                    lines.append(pending)
                    pending = b""
                for line in lines:
                    logger.info(line.decode(errors="replace").rstrip("\r"))
                if time.monotonic() - saved_at >= LOG_SAVE_SECONDS:
                    await logger.save_log()
                    saved_at = time.monotonic()
            if pending:
                logger.info(pending.decode(errors="replace").rstrip("\r"))
        except (TimeoutError, aiohttp.ClientError) as e:
            logger.warning(f"The {container} log stream broke off: {e}")
        finally:
            response.release()
            await logger.save_log()

    @staticmethod
    async def _delete_job(batch: client.BatchV1Api, name: str, namespace: str) -> None:
        await delete_ignoring_missing(
            f"build Job {namespace}/{name}",
            batch.delete_namespaced_job(name, namespace, propagation_policy="Background"),
        )
