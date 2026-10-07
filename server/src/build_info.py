import json
import os
import subprocess
from pathlib import Path


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
    repository = os.getenv("REPOSITORY") or defaults["repository"]
    repository_url = os.getenv("REPOSITORY_URL") or defaults["repository_url"]

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
