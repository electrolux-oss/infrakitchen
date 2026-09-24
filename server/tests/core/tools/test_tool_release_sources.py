import hashlib
from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from core.tools import release_sources
from core.tools.release_sources import (
    download_release,
    filter_and_sort_versions,
    find_checksum,
    get_release_source,
    parse_versions,
)


class TestParseVersions:
    def test_opentofu(self):
        payload = {"versions": [{"id": "1.8.0", "files": []}, {"id": "1.13.0-rc1", "files": []}]}
        assert parse_versions("opentofu", payload) == ["1.8.0", "1.13.0-rc1"]

    def test_terraform(self):
        payload = {"name": "terraform", "versions": {"1.5.7": {}, "0.12.31": {}}}
        assert parse_versions("terraform", payload) == ["1.5.7", "0.12.31"]

    def test_unsupported(self):
        with pytest.raises(ValueError):
            _ = parse_versions("pulumi", {})


class TestFilterAndSortVersions:
    def test_sorts_newest_first_and_skips_prereleases(self):
        versions = ["1.5.7", "1.10.0", "1.6.0-rc1", "0.12.31", "1.9.1", "invalid"]
        assert filter_and_sort_versions(versions) == ["1.10.0", "1.9.1", "1.5.7", "0.12.31"]

    def test_prerelease_sorts_before_final(self):
        versions = ["1.6.0", "1.6.0-rc1", "1.6.0-beta2", "1.5.7"]
        assert filter_and_sort_versions(versions, include_prerelease=True) == [
            "1.6.0",
            "1.6.0-rc1",
            "1.6.0-beta2",
            "1.5.7",
        ]


class TestReleaseSource:
    def test_opentofu_urls(self):
        source = get_release_source("opentofu")
        assert source.executable == "tofu"
        assert (
            source.download_url("1.8.0", "linux", "amd64")
            == "https://github.com/opentofu/opentofu/releases/download/v1.8.0/tofu_1.8.0_linux_amd64.zip"
        )
        assert (
            source.shasums_url("1.8.0")
            == "https://github.com/opentofu/opentofu/releases/download/v1.8.0/tofu_1.8.0_SHA256SUMS"
        )

    def test_terraform_urls(self):
        source = get_release_source("terraform")
        assert (
            source.download_url("1.5.7", "linux", "arm64")
            == "https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_linux_arm64.zip"
        )
        assert (
            source.shasums_url("1.5.7") == "https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_SHA256SUMS"
        )

    def test_unsupported(self):
        with pytest.raises(ValueError, match="Unsupported tool"):
            _ = get_release_source("pulumi")


class TestFindChecksum:
    def test_found(self):
        shasums = "aaa  terraform_1.5.7_darwin_amd64.zip\nBBB  terraform_1.5.7_linux_amd64.zip\n"
        assert find_checksum(shasums, "terraform_1.5.7_linux_amd64.zip") == "bbb"

    def test_missing(self):
        with pytest.raises(ValueError, match="not found"):
            _ = find_checksum("aaa  other.zip", "terraform_1.5.7_linux_amd64.zip")


def _mock_http_client(monkeypatch, responses: dict[str, httpx.Response]):
    client = Mock()

    async def get(url):
        return responses[url]

    client.get = AsyncMock(side_effect=get)
    context = Mock()
    context.__aenter__ = AsyncMock(return_value=client)
    context.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(release_sources.httpx, "AsyncClient", Mock(return_value=context))
    return client


def _response(url: str, content: bytes) -> httpx.Response:
    return httpx.Response(200, content=content, request=httpx.Request("GET", url))


class TestDownloadRelease:
    async def test_verifies_checksum(self, monkeypatch):
        source = get_release_source("terraform")
        content = b"zip-content"
        sha = hashlib.sha256(content).hexdigest()
        shasums = f"{sha}  terraform_1.5.7_linux_amd64.zip\n".encode()
        _ = _mock_http_client(
            monkeypatch,
            {
                source.shasums_url("1.5.7"): _response(source.shasums_url("1.5.7"), shasums),
                source.download_url("1.5.7", "linux", "amd64"): _response(
                    source.download_url("1.5.7", "linux", "amd64"), content
                ),
            },
        )

        result, checksum = await download_release(source, "1.5.7", "linux", "amd64")

        assert result == content
        assert checksum == sha

    async def test_checksum_mismatch(self, monkeypatch):
        source = get_release_source("terraform")
        shasums = f"{'0' * 64}  terraform_1.5.7_linux_amd64.zip\n".encode()
        _ = _mock_http_client(
            monkeypatch,
            {
                source.shasums_url("1.5.7"): _response(source.shasums_url("1.5.7"), shasums),
                source.download_url("1.5.7", "linux", "amd64"): _response(
                    source.download_url("1.5.7", "linux", "amd64"), b"tampered"
                ),
            },
        )

        with pytest.raises(ValueError, match="Checksum mismatch"):
            _ = await download_release(source, "1.5.7", "linux", "amd64")
