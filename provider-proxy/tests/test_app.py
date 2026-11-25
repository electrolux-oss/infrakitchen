import hashlib
import os
import time

import httpx
import pytest
from fastapi.testclient import TestClient

import app as proxy

ZIP = b"provider zip content"
SHASUM = hashlib.sha256(ZIP).hexdigest()
BASE = "https://registry.opentofu.org/v1/providers/hashicorp/random"


class Upstream:
    """Fake registry that counts the requests it gets."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.shasum = SHASUM
        self.versions = ["3.6.0"]
        self.down = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        self.calls.append(url)
        if self.down:
            return httpx.Response(503)
        if url == f"{BASE}/versions":
            platforms = [{"os": "linux", "arch": "amd64"}, {"os": "darwin", "arch": "arm64"}]
            return httpx.Response(
                200, json={"versions": [{"version": v, "platforms": platforms} for v in self.versions]}
            )
        if url.startswith(f"{BASE}/3.6.0/download/"):
            os_name, arch = url.rsplit("/", 2)[-2:]
            return httpx.Response(
                200,
                json={
                    "os": os_name,
                    "arch": arch,
                    "download_url": f"https://github.example/random_{os_name}_{arch}.zip",
                    "shasum": self.shasum,
                },
            )
        if url.startswith("https://github.example/"):
            return httpx.Response(200, content=ZIP)
        return httpx.Response(404)


@pytest.fixture
def upstream(monkeypatch, tmp_path) -> Upstream:
    fake = Upstream()
    monkeypatch.setenv("CACHE_DIR", str(tmp_path))
    monkeypatch.delenv("UPSTREAMS", raising=False)
    monkeypatch.delenv("INDEX_TTL", raising=False)
    monkeypatch.setattr(proxy, "make_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(fake.handler)))
    proxy._locks.clear()
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(proxy.app)


def test_index_lists_upstream_versions(upstream, client, tmp_path):
    response = client.get("/registry.opentofu.org/hashicorp/random/index.json")

    assert response.status_code == 200
    assert response.json() == {"versions": {"3.6.0": {}}}
    assert (tmp_path / "registry.opentofu.org/hashicorp/random/index.json").exists()


def test_index_is_served_from_disk_until_it_is_stale(upstream, client, tmp_path):
    client.get("/registry.opentofu.org/hashicorp/random/index.json")
    client.get("/registry.opentofu.org/hashicorp/random/index.json")
    assert len(upstream.calls) == 1

    path = tmp_path / "registry.opentofu.org/hashicorp/random/index.json"
    old = time.time() - 7200
    os.utime(path, (old, old))
    upstream.versions = ["3.6.0", "3.7.0"]

    response = client.get("/registry.opentofu.org/hashicorp/random/index.json")

    assert response.json() == {"versions": {"3.6.0": {}, "3.7.0": {}}}
    assert len(upstream.calls) == 2


def test_stale_index_is_served_when_upstream_is_down(upstream, client, tmp_path):
    client.get("/registry.opentofu.org/hashicorp/random/index.json")
    path = tmp_path / "registry.opentofu.org/hashicorp/random/index.json"
    old = time.time() - 7200
    os.utime(path, (old, old))
    upstream.down = True

    response = client.get("/registry.opentofu.org/hashicorp/random/index.json")

    assert response.status_code == 200
    assert response.json() == {"versions": {"3.6.0": {}}}


def test_version_lists_archives_of_every_platform(upstream, client):
    response = client.get("/registry.opentofu.org/hashicorp/random/3.6.0.json")

    assert response.status_code == 200
    assert response.json() == {
        "archives": {
            "linux_amd64": {"url": "3.6.0/linux_amd64.zip", "hashes": [f"zh:{SHASUM}"]},
            "darwin_arm64": {"url": "3.6.0/darwin_arm64.zip", "hashes": [f"zh:{SHASUM}"]},
        }
    }


def test_unknown_version_is_404(upstream, client):
    response = client.get("/registry.opentofu.org/hashicorp/random/9.9.9.json")

    assert response.status_code == 404


def test_archive_is_downloaded_once(upstream, client, tmp_path):
    first = client.get("/registry.opentofu.org/hashicorp/random/3.6.0/linux_amd64.zip")
    calls = len(upstream.calls)
    second = client.get("/registry.opentofu.org/hashicorp/random/3.6.0/linux_amd64.zip")

    assert first.content == ZIP
    assert second.content == ZIP
    assert len(upstream.calls) == calls
    assert (tmp_path / "registry.opentofu.org/hashicorp/random/3.6.0/linux_amd64.zip").read_bytes() == ZIP


def test_archive_with_wrong_checksum_is_rejected(upstream, client, tmp_path):
    upstream.shasum = "0" * 64

    response = client.get("/registry.opentofu.org/hashicorp/random/3.6.0/linux_amd64.zip")

    assert response.status_code == 502
    assert list((tmp_path / "registry.opentofu.org/hashicorp/random/3.6.0").iterdir()) == []


def test_upstream_not_in_the_allow_list_is_404(upstream, client):
    response = client.get("/evil.example.com/hashicorp/random/index.json")

    assert response.status_code == 404
    assert upstream.calls == []


def test_names_cannot_leave_the_cache_dir(upstream, client):
    response = client.get("/registry.opentofu.org/hashicorp/..random/3.6.0/linux_amd64.zip")
    assert response.status_code in (400, 404)
    response = client.get("/registry.opentofu.org/.hidden/random/index.json")
    assert response.status_code == 400


def test_safe_path_refuses_to_leave_the_cache_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CACHE_DIR", str(tmp_path))
    assert proxy.safe_path("a", "b.json") == tmp_path / "a" / "b.json"
    for parts in (("..", "x"), ("a", "..", "..", "x"), ("/etc/passwd",)):
        with pytest.raises(proxy.HTTPException) as error:
            proxy.safe_path(*parts)
        assert error.value.status_code == 400


def test_name_with_trailing_newline_is_rejected(upstream, client):
    response = client.get("/registry.opentofu.org/hashicorp/random%0A/index.json")
    assert response.status_code == 400
