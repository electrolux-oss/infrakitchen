import json
import os
import subprocess
from pathlib import Path
from urllib.parse import urlparse


MODULE_DIR = Path(__file__).resolve().parent
SOURCE_SERVER_ROOT = MODULE_DIR.parent if MODULE_DIR.name == "src" else MODULE_DIR
REPO_ROOT = SOURCE_SERVER_ROOT.parent if SOURCE_SERVER_ROOT.name == "server" else SOURCE_SERVER_ROOT
BUILD_INFO_PATH = SOURCE_SERVER_ROOT / "build-info.json"
VERSION_PATH = REPO_ROOT / "VERSION"
DEFAULT_REPOSITORY = "electrolux-oss/infrakitchen"


def _read_version_file() -> str:
    try:
        return VERSION_PATH.read_text(encoding="utf-8").strip() or "unknown"
    except OSError:
        return "unknown"


def _git_output(*args: str) -> str:
    try:
        return subprocess.check_output(
            ["git", *args],
            cwd=REPO_ROOT,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _repository_from_remote(remote_url: str) -> str:
    if not remote_url or remote_url == "unknown":
        return "unknown"

    normalized_url = remote_url.strip()
    if normalized_url.endswith(".git"):
        normalized_url = normalized_url[:-4]

    if normalized_url.startswith("git@") and ":" in normalized_url:
        _, path = normalized_url.split(":", 1)
        return path.strip("/") or "unknown"

    if normalized_url.startswith("ssh://"):
        parsed = urlparse(normalized_url)
        if parsed.path:
            return parsed.path.strip("/") or "unknown"

    if normalized_url.startswith("http://") or normalized_url.startswith("https://"):
        parsed = urlparse(normalized_url)
        if parsed.path:
            return parsed.path.strip("/") or "unknown"

    return "unknown"


def _repository_url_from_remote(remote_url: str) -> str:
    if not remote_url or remote_url == "unknown":
        return ""

    normalized_url = remote_url.strip()
    if normalized_url.endswith(".git"):
        normalized_url = normalized_url[:-4]

    if normalized_url.startswith("git@") and ":" in normalized_url:
        host, path = normalized_url.removeprefix("git@").split(":", 1)
        return f"https://{host}/{path}"

    if normalized_url.startswith("ssh://git@"):
        parsed = urlparse(normalized_url)
        if parsed.hostname and parsed.path:
            return f"https://{parsed.hostname}{parsed.path}"

    if normalized_url.startswith("http://") or normalized_url.startswith("https://"):
        return normalized_url

    return ""


def build_info_defaults() -> dict[str, str]:
    version = _read_version_file()
    return {
        "version": version,
        "git_commit": "unknown",
        "git_commit_short": "unknown",
        "repository": DEFAULT_REPOSITORY,
        "repository_url": f"https://github.com/{DEFAULT_REPOSITORY}",
    }


def build_info_payload() -> dict[str, str]:
    defaults = build_info_defaults()
    remote_url = _git_output("config", "--get", "remote.origin.url")
    repository = os.getenv("REPOSITORY") or _repository_from_remote(remote_url) or defaults["repository"]
    repository_url = (
        os.getenv("REPOSITORY_URL") or _repository_url_from_remote(remote_url) or defaults["repository_url"]
    )

    return {
        "version": defaults["version"],
        "git_commit": _git_output("rev-parse", "HEAD"),
        "git_commit_short": _git_output("rev-parse", "--short", "HEAD"),
        "repository": repository,
        "repository_url": repository_url,
    }


def load_build_info() -> dict[str, str]:
    defaults = build_info_defaults()

    try:
        raw_build_info = json.loads(BUILD_INFO_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return defaults

    return {
        "version": str(raw_build_info.get("version") or defaults["version"]),
        "git_commit": str(raw_build_info.get("git_commit") or defaults["git_commit"]),
        "git_commit_short": str(raw_build_info.get("git_commit_short") or defaults["git_commit_short"]),
        "repository": str(raw_build_info.get("repository") or defaults["repository"]),
        "repository_url": str(raw_build_info.get("repository_url") or defaults["repository_url"]),
    }


def write_build_info() -> Path:
    payload = build_info_payload()
    BUILD_INFO_PATH.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    return BUILD_INFO_PATH
