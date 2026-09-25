import hashlib
import logging
from dataclasses import dataclass
from typing import Any

import httpx

from core.caches.functions import cache_decorator

from .schema import VERSION_RE, ToolName

logger = logging.getLogger(__name__)

DOWNLOAD_TIMEOUT = httpx.Timeout(30.0, read=300.0)


@dataclass(frozen=True)
class ReleaseSource:
    tool: ToolName
    display_name: str
    executable: str
    versions_url: str
    download_url_template: str
    shasums_url_template: str

    def archive_name(self, version: str, os: str, arch: str) -> str:
        return f"{self.executable}_{version}_{os}_{arch}.zip"

    def download_url(self, version: str, os: str, arch: str) -> str:
        return self.download_url_template.format(version=version, archive=self.archive_name(version, os, arch))

    def shasums_url(self, version: str) -> str:
        return self.shasums_url_template.format(version=version, executable=self.executable)


RELEASE_SOURCES: dict[str, ReleaseSource] = {
    "opentofu": ReleaseSource(
        tool="opentofu",
        display_name="OpenTofu",
        executable="tofu",
        versions_url="https://get.opentofu.org/tofu/api.json",
        download_url_template="https://github.com/opentofu/opentofu/releases/download/v{version}/{archive}",
        shasums_url_template=(
            "https://github.com/opentofu/opentofu/releases/download/v{version}/{executable}_{version}_SHA256SUMS"
        ),
    ),
    "terraform": ReleaseSource(
        tool="terraform",
        display_name="Terraform",
        executable="terraform",
        versions_url="https://releases.hashicorp.com/terraform/index.json",
        download_url_template="https://releases.hashicorp.com/terraform/{version}/{archive}",
        shasums_url_template="https://releases.hashicorp.com/terraform/{version}/{executable}_{version}_SHA256SUMS",
    ),
}


def get_release_source(tool: str) -> ReleaseSource:
    source = RELEASE_SOURCES.get(tool)
    if source is None:
        raise ValueError(f"Unsupported tool: {tool}. Supported: {', '.join(RELEASE_SOURCES)}")
    return source


def parse_versions(tool: str, payload: dict[str, Any]) -> list[str]:
    """Extract version strings from the upstream release index."""
    match tool:
        case "opentofu":
            # {"versions": [{"id": "1.8.0", "files": [...]}, ...]}
            return [str(item["id"]) for item in payload.get("versions", []) if "id" in item]
        case "terraform":
            # {"name": "terraform", "versions": {"1.5.7": {...}, ...}}
            return list(payload.get("versions", {}).keys())
        case _:
            raise ValueError(f"Unsupported tool: {tool}")


def version_sort_key(version: str) -> tuple[int, int, int, int, str]:
    match = VERSION_RE.match(version)
    if not match:
        return (-1, -1, -1, -1, version)
    major, minor, patch, prerelease = match.groups()
    # final releases sort after their prereleases
    return (int(major), int(minor), int(patch), 0 if prerelease else 1, prerelease or "")


def filter_and_sort_versions(versions: list[str], include_prerelease: bool = False) -> list[str]:
    result: list[str] = []
    for version in versions:
        match = VERSION_RE.match(version)
        if not match:
            continue
        if match.group(4) and not include_prerelease:
            continue
        result.append(version)
    return sorted(set(result), key=version_sort_key, reverse=True)


@cache_decorator(ttl=3600)
async def fetch_release_versions(tool: str) -> list[str]:
    source = get_release_source(tool)
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        response = await client.get(source.versions_url)
        _ = response.raise_for_status()
        return parse_versions(tool, response.json())


async def list_versions(tool: str, include_prerelease: bool = False) -> list[str]:
    """Available upstream versions, newest first."""
    return filter_and_sort_versions(await fetch_release_versions(tool), include_prerelease=include_prerelease)


def find_checksum(shasums: str, filename: str) -> str:
    """Find the checksum for `filename` in a SHA256SUMS file (`<sha256>  <filename>` per line)."""
    for line in shasums.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1].lstrip("*") == filename:
            return parts[0].lower()
    raise ValueError(f"Checksum for {filename} not found")


async def download_release(source: ReleaseSource, version: str, os: str, arch: str) -> tuple[bytes, str]:
    """
    Download a release archive and verify it against the published SHA256SUMS.
    Returns the archive content and its sha256.
    """
    archive = source.archive_name(version, os, arch)
    async with httpx.AsyncClient(follow_redirects=True, timeout=DOWNLOAD_TIMEOUT) as client:
        shasums_response = await client.get(source.shasums_url(version))
        _ = shasums_response.raise_for_status()
        expected = find_checksum(shasums_response.text, archive)

        logger.info(f"Downloading {source.download_url(version, os, arch)}")
        response = await client.get(source.download_url(version, os, arch))
        _ = response.raise_for_status()
        content = response.content

    actual = hashlib.sha256(content).hexdigest()
    if actual != expected:
        raise ValueError(f"Checksum mismatch for {archive}: expected {expected}, got {actual}")
    return content, actual
