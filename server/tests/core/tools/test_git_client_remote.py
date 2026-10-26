import re
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from core.tools.git_client import GitClient, parse_git_log, parse_ls_remote_symref, parse_ls_remote_tags

URL = "https://github.com/org/repo"
LOG = (
    "b" * 40
    + "\x1fDev\x1fdev@example.com\x1f2026-10-07T10:00:00+02:00\x1fcommit 1\x1f\x1e\n"
    + "a" * 40
    + "\x1fDev\x1fdev@example.com\x1f2026-10-06T10:00:00+02:00\x1fcommit 0\x1f\x1e\n"
)


@pytest.fixture
def git_client(tmp_path: Path) -> GitClient:
    return GitClient(git_url=URL, workspace_path=str(tmp_path), repo_name="repo.git", environment_variables={})


def _run_git(git_client: GitClient, output: str = "", log: str = LOG) -> AsyncMock:
    """Replace the git runner; `git log --output=<file>` gets `log` written to that file."""

    async def run(command_args: list[str], workspace_path: str) -> str:
        for arg in command_args:
            if match := re.fullmatch(r"--output=(.+)", arg):
                _ = Path(match[1]).write_text(log)
        return output

    mock = AsyncMock(side_effect=run)
    git_client._run_git_command = mock  # pyright: ignore[reportAttributeAccessIssue]
    return mock


def _args(mock: AsyncMock) -> list[list[str]]:
    return [call.args[0] for call in mock.await_args_list]


class TestParsers:
    def test_parse_ls_remote_symref(self):
        output = "ref: refs/heads/main\tHEAD\n3f2c1e0\tHEAD"
        assert parse_ls_remote_symref(output) == "main"

    def test_parse_ls_remote_symref_without_symref(self):
        assert parse_ls_remote_symref("3f2c1e0\tHEAD") is None

    def test_parse_ls_remote_tags_peels_annotated_tags(self):
        output = "tagobj\trefs/tags/v2.0.0\ncommit2\trefs/tags/v2.0.0^{}\ncommit1\trefs/tags/v1.0.0\nx\trefs/heads/main"
        tags = parse_ls_remote_tags(output)
        assert [(t.name, t.sha) for t in tags] == [("v2.0.0", "commit2"), ("v1.0.0", "commit1")]

    def test_parse_git_log_skips_malformed_records(self):
        output = (
            "abc\x1fDev\x1fdev@example.com\x1f2026-10-07T10:00:00+02:00\x1fFix: a | b\x1fLine 1\n\nLine 2\n\x1e\n"
            "def\x1fDev\x1fdev@example.com\x1f2026-10-06T10:00:00+02:00\x1fNo body\x1f\x1e\n"
            "not a commit"
        )
        commits = parse_git_log(output)
        assert [c.sha for c in commits] == ["abc", "def"]
        assert commits[0].message == "Fix: a | b"
        assert commits[0].description == "Line 1\n\nLine 2"
        assert commits[0].authored_at.isoformat() == "2026-10-07T10:00:00+02:00"
        assert commits[1].description == ""


class TestRemoteReads:
    async def test_default_branch(self, git_client: GitClient):
        run = _run_git(git_client, output="ref: refs/heads/trunk\tHEAD\nabc\tHEAD")

        assert await git_client.get_remote_default_branch() == "trunk"
        assert _args(run) == [["ls-remote", "--symref", URL, "HEAD"]]

    async def test_tags_newest_version_first(self, git_client: GitClient):
        run = _run_git(git_client, output="c1\trefs/tags/v1.10.0\nc0\trefs/tags/v1.2.0")

        assert [(t.name, t.sha) for t in await git_client.get_remote_tags()] == [("v1.10.0", "c1"), ("v1.2.0", "c0")]
        assert _args(run) == [["ls-remote", "--tags", "--sort=-version:refname", URL]]

    async def test_branch_head(self, git_client: GitClient):
        run = _run_git(git_client, output="abc\trefs/heads/trunk")

        assert await git_client.get_remote_branch_head("trunk") == "abc"
        assert await git_client.get_remote_branch_head("missing") is None
        assert _args(run)[0] == ["ls-remote", URL, "refs/heads/trunk"]

    async def test_fetch_only_commit_objects(self, git_client: GitClient):
        run = _run_git(git_client)

        await git_client.fetch_branch("trunk", depth=50)
        await git_client.deepen_fetched("trunk", by=50)

        assert _args(run) == [
            ["init", "--bare", "-q", git_client.destination_dir],
            ["fetch", "-q", "--no-tags", "--filter=tree:0", "--depth=50", URL, "refs/heads/trunk"],
            ["fetch", "-q", "--no-tags", "--filter=tree:0", "--deepen=50", URL, "refs/heads/trunk"],
        ]

    async def test_rejects_option_like_refs(self, git_client: GitClient):
        run = _run_git(git_client)

        with pytest.raises(ValueError):
            await git_client.fetch_branch("--upload-pack=evil")
        with pytest.raises(ValueError):
            await git_client.deepen_fetched("--upload-pack=evil", by=1)
        with pytest.raises(ValueError):
            await git_client.get_fetched_commits(since="--output=/etc/passwd")
        assert run.await_count == 0

    async def test_is_fetched_shallow(self, git_client: GitClient):
        _ = _run_git(git_client, output="true\n")
        assert await git_client.is_fetched_shallow()

        _ = _run_git(git_client, output="false\n")
        assert not await git_client.is_fetched_shallow()

    async def test_fetched_commits(self, git_client: GitClient, tmp_path: Path):
        run = _run_git(git_client)

        commits = await git_client.get_fetched_commits(since="a" * 40, first_parent=True)

        assert [c.message for c in commits] == ["commit 1", "commit 0"]
        assert commits[0].author_email == "dev@example.com"
        args = _args(run)[0]
        assert args[0] == "log" and args[-2:] == ["--first-parent", f"{'a' * 40}..FETCH_HEAD"]
        # The log file is removed once read.
        assert list(tmp_path.iterdir()) == []

    async def test_fetched_shas(self, git_client: GitClient):
        run = _run_git(git_client, log="b\na\n")

        assert await git_client.get_fetched_shas(first_parent=True) == {"a", "b"}
        assert "--first-parent" in _args(run)[0]
