"""
Caching proxy for OpenTofu / Terraform providers.

Implements the provider network mirror protocol:
https://opentofu.org/docs/internals/provider-network-mirror-protocol/

Every response is a file under CACHE_DIR at the request path. If the file exists it is served,
otherwise it is built from the upstream registry, saved and then served.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger("provider-proxy")

TIMEOUT = httpx.Timeout(30.0, read=300.0)
# path segments end up in file paths, so only plain names are allowed
NAME = re.compile(r"[A-Za-z0-9_-][A-Za-z0-9._-]*")

app = FastAPI(title="Provider proxy")
_locks: dict[str, asyncio.Lock] = {}


def cache_dir() -> Path:
    return Path(os.environ.get("CACHE_DIR", "/var/cache/provider-proxy"))


def safe_path(*parts: str) -> Path:
    """Join `parts` under CACHE_DIR, refusing anything that resolves outside of it."""
    root = os.path.normpath(os.path.abspath(cache_dir()))
    path = os.path.normpath(os.path.join(root, *parts))
    if not path.startswith(root + os.sep):
        raise HTTPException(400, "invalid path")
    return Path(path)


def upstreams() -> set[str]:
    value = os.environ.get("UPSTREAMS", "registry.opentofu.org,registry.terraform.io")
    return {host.strip() for host in value.split(",") if host.strip()}


def index_ttl() -> int:
    return int(os.environ.get("INDEX_TTL", "3600"))


def make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(follow_redirects=True, timeout=TIMEOUT)


def check(hostname: str, *names: str) -> None:
    if hostname not in upstreams():
        raise HTTPException(404, f"{hostname} is not an allowed upstream")
    for name in names:
        if not NAME.fullmatch(name):
            raise HTTPException(400, f"invalid name: {name}")


def api_url(hostname: str, namespace: str, type: str) -> str:
    return f"https://{hostname}/v1/providers/{namespace}/{type}"


async def get_json(client: httpx.AsyncClient, url: str) -> Any:
    response = await client.get(url)
    if response.status_code == 404:
        raise HTTPException(404, f"not found upstream: {url}")
    response.raise_for_status()
    return response.json()


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


async def cached(path: Path, build, max_age: int | None = None) -> FileResponse:
    """Serve `path`, building it with `build()` when it is missing (or older than `max_age`)."""
    fresh = path.exists() and (max_age is None or time.time() - path.stat().st_mtime < max_age)
    if not fresh:
        lock = _locks.setdefault(str(path), asyncio.Lock())
        async with lock:
            fresh = path.exists() and (max_age is None or time.time() - path.stat().st_mtime < max_age)
            if not fresh:
                try:
                    await build(path)
                except HTTPException:
                    raise
                except Exception as e:
                    if not path.exists():
                        logger.exception("upstream request for %s failed", path)
                        raise HTTPException(502, f"upstream request failed: {e}") from e
                    # keep serving the old index while upstream is down
                    logger.warning("upstream request for %s failed, serving the cached file: %s", path, e)
    return FileResponse(path)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/{hostname}/{namespace}/{type}/index.json")
async def index(hostname: str, namespace: str, type: str) -> FileResponse:
    check(hostname, namespace, type)

    async def build(path: Path) -> None:
        async with make_client() as client:
            data = await get_json(client, f"{api_url(hostname, namespace, type)}/versions")
        versions = {v["version"]: {} for v in data.get("versions", [])}
        write_atomic(path, json.dumps({"versions": versions}).encode())

    return await cached(safe_path(hostname, namespace, type, "index.json"), build, max_age=index_ttl())


@app.get("/{hostname}/{namespace}/{type}/{version}.json")
async def version(hostname: str, namespace: str, type: str, version: str) -> FileResponse:
    check(hostname, namespace, type, version)
    base = api_url(hostname, namespace, type)

    async def build(path: Path) -> None:
        async with make_client() as client:
            data = await get_json(client, f"{base}/versions")
            release = next((v for v in data.get("versions", []) if v["version"] == version), None)
            if release is None:
                raise HTTPException(404, f"version {version} not found upstream")
            downloads = await asyncio.gather(
                *(
                    get_json(client, f"{base}/{version}/download/{p['os']}/{p['arch']}")
                    for p in release.get("platforms", [])
                )
            )
        archives = {
            f"{d['os']}_{d['arch']}": {
                # relative to this file, so the proxy doesn't need to know its own address
                "url": f"{version}/{d['os']}_{d['arch']}.zip",
                "hashes": [f"zh:{d['shasum']}"],
            }
            for d in downloads
        }
        write_atomic(path, json.dumps({"archives": archives}).encode())

    return await cached(safe_path(hostname, namespace, type, f"{version}.json"), build)


@app.get("/{hostname}/{namespace}/{type}/{version}/{platform}.zip")
async def archive(hostname: str, namespace: str, type: str, version: str, platform: str) -> FileResponse:
    check(hostname, namespace, type, version, platform)
    os_name, _, arch = platform.partition("_")
    if not os_name or not arch:
        raise HTTPException(400, f"invalid platform: {platform}")

    async def build(path: Path) -> None:
        async with make_client() as client:
            meta = await get_json(client, f"{api_url(hostname, namespace, type)}/{version}/download/{os_name}/{arch}")
            path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
            try:
                digest = hashlib.sha256()
                with os.fdopen(fd, "wb") as f:
                    async with client.stream("GET", meta["download_url"]) as response:
                        response.raise_for_status()
                        async for chunk in response.aiter_bytes():
                            digest.update(chunk)
                            f.write(chunk)
                if digest.hexdigest() != meta["shasum"]:
                    raise HTTPException(502, f"checksum mismatch for {meta['download_url']}")
                os.replace(tmp, path)
            except BaseException:
                os.unlink(tmp)
                raise
        logger.info("cached %s", path)

    return await cached(safe_path(hostname, namespace, type, version, f"{platform}.zip"), build)
