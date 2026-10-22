"""Minimal async client for the Docker Engine API, built on httpx (no Docker SDK needed)."""

import json
from typing import Any
from urllib.parse import quote, urlparse

import httpx

DEFAULT_DOCKER_HOST = "unix:///var/run/docker.sock"


class DockerError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"Docker API error {status}: {message}")
        self.status: int = status
        self.message: str = message


def _transport_and_base_url(docker_host: str) -> tuple[httpx.AsyncBaseTransport | None, str]:
    """``unix:///path`` talks over the socket; ``tcp://host:port`` and ``http(s)://`` over the network."""
    parsed = urlparse(docker_host)
    if parsed.scheme == "unix":
        return httpx.AsyncHTTPTransport(uds=parsed.path), "http://docker"
    if parsed.scheme == "tcp":
        return None, f"http://{parsed.netloc}"
    if parsed.scheme in ("http", "https"):
        return None, docker_host.rstrip("/")
    raise ValueError(f"Unsupported Docker host '{docker_host}': use unix://, tcp://, http:// or https://")


def split_image(image: str) -> tuple[str, str | None]:
    """``registry:5000/repo:tag`` -> (``registry:5000/repo``, ``tag``); digests are pulled as they are."""
    if "@" in image:
        return image, None
    repository, separator, tag = image.rpartition(":")
    if separator and "/" not in tag:
        return repository, tag
    return image, "latest"


def decode_log_stream(content: bytes) -> str:
    """Logs of a container without a TTY are framed: 1 byte stream, 3 zero bytes, 4 bytes big-endian size, payload."""
    chunks: list[bytes] = []
    position = 0
    while position + 8 <= len(content):
        if content[position] not in (0, 1, 2) or content[position + 1 : position + 4] != b"\x00\x00\x00":
            # Not framed: the container has a TTY and the logs are plain text
            return content.decode("utf-8", errors="replace")
        size = int.from_bytes(content[position + 4 : position + 8], "big")
        chunks.append(content[position + 8 : position + 8 + size])
        position += 8 + size
    if not chunks:
        return content.decode("utf-8", errors="replace")
    return b"".join(chunks).decode("utf-8", errors="replace")


class DockerClient:
    def __init__(self, docker_host: str = DEFAULT_DOCKER_HOST, timeout: float = 30.0):
        self.docker_host: str = docker_host
        self.timeout: float = timeout
        # Validates the host early
        _ = _transport_and_base_url(docker_host)

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        body: Any = None,
        timeout: float | None = None,
        raw: bool = False,
    ) -> Any:
        transport, base_url = _transport_and_base_url(self.docker_host)
        async with httpx.AsyncClient(transport=transport, base_url=base_url, timeout=timeout or self.timeout) as client:
            response = await client.request(method, path, params=params, json=body)
        if response.status_code >= 400:
            try:
                message = response.json().get("message", response.text)
            except ValueError:
                message = response.text
            raise DockerError(response.status_code, message)
        if raw:
            return response.content
        if not response.content:
            return None
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()
        return response.text

    async def ping(self) -> None:
        _ = await self._request("GET", "/_ping")

    async def create_container(self, name: str, body: dict[str, Any]) -> str:
        result = await self._request("POST", "/containers/create", params={"name": name}, body=body)
        return result["Id"]

    async def start_container(self, container_id: str) -> None:
        _ = await self._request("POST", f"/containers/{quote(container_id)}/start")

    async def inspect_container(self, container_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/containers/{quote(container_id)}/json")

    async def list_containers(self, labels: dict[str, str]) -> list[dict[str, Any]]:
        filters = {"label": [f"{key}={value}" for key, value in labels.items()]}
        return await self._request("GET", "/containers/json", params={"all": "true", "filters": json.dumps(filters)})

    async def container_logs(self, container_id: str, tail: int = 500) -> str:
        """The last ``tail`` lines of stdout and stderr, with timestamps."""
        params = {"stdout": "true", "stderr": "true", "timestamps": "true", "tail": str(tail)}
        content: bytes = await self._request("GET", f"/containers/{quote(container_id)}/logs", params=params, raw=True)
        return decode_log_stream(content)

    async def remove_container(self, container_id: str) -> None:
        """Force-remove a container; one that is already gone or being removed is fine."""
        try:
            _ = await self._request("DELETE", f"/containers/{quote(container_id)}", params={"force": "true"})
        except DockerError as e:
            if e.status not in (404, 409):
                raise

    async def image_exists(self, image: str) -> bool:
        try:
            _ = await self._request("GET", f"/images/{quote(image, safe='')}/json")
        except DockerError as e:
            if e.status == 404:
                return False
            raise
        return True

    async def pull_image(self, image: str, timeout: float = 600.0) -> None:
        """Pull an image; the API streams progress lines and reports errors inside the stream."""
        repository, tag = split_image(image)
        params = {"fromImage": repository} | ({"tag": tag} if tag else {})
        output = await self._request("POST", "/images/create", params=params, timeout=timeout)
        for line in str(output or "").splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if isinstance(event, dict) and event.get("error"):
                raise DockerError(500, str(event["error"]))

    async def inspect_image(self, image: str) -> dict[str, Any]:
        return await self._request("GET", f"/images/{quote(image, safe='')}/json")

    async def inspect_network(self, network: str) -> dict[str, Any]:
        return await self._request("GET", f"/networks/{quote(network, safe='')}")
