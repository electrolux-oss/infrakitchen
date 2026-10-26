from datetime import datetime
from typing import Any, cast
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.source_codes.model import SourceCode, SourceCodeCommit
from application.source_codes.task import SourceCodeTask
from core.constants.model import ModelActions, ModelStatus
from core.errors import ShellExecutionError
from core.tools.git_client import GitCommit, GitTag
from core.users.model import User


def _source_code(**kwargs) -> SourceCode:
    creator = User(
        id=uuid4(),
        identifier="dev",
        provider="local",
        primary_account=[],
        secondary_accounts=[],
        deactivated=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    defaults = {
        "id": uuid4(),
        "description": "",
        "source_code_url": "https://github.com/org/repo",
        "source_code_provider": "github",
        "source_code_language": "opentofu",
        "integration_id": None,
        "integration": None,
        "status": ModelStatus.READY,
        "creator": creator,
        "created_by": creator.id,
        "revision_number": 1,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "git_tags": [],
        "git_branches": [],
        "git_folders_map": [],
        "default_branch": None,
        "git_tag_shas": None,
        "labels": [],
    }
    return SourceCode(**{**defaults, **kwargs})


class FakeRemote:
    """A commit graph standing in for a remote repository."""

    def __init__(self) -> None:
        self.commits: dict[str, tuple[GitCommit, list[str]]] = {}
        self.branches: dict[str, str] = {}
        self.default_branch: str | None = "trunk"
        self.tags: list[GitTag] = []

    def commit(
        self, message: str, branch: str = "trunk", parents: list[str] | None = None, description: str = ""
    ) -> str:
        sha = f"{len(self.commits) + 1:040x}"
        if parents is None:
            parents = [self.branches[branch]] if branch in self.branches else []
        commit = GitCommit(
            sha=sha,
            author_name="Dev",
            author_email="dev@example.com",
            authored_at=datetime(2026, 1, 1),
            message=message,
            description=description,
        )
        self.commits[sha] = (commit, parents)
        self.branches[branch] = sha
        return sha

    def parents(self, sha: str) -> list[str]:
        return self.commits[sha][1]


class FakeGitClient:
    """The GitClient methods used by the sync, with git's fetch semantics over a FakeRemote."""

    def __init__(self, remote: FakeRemote) -> None:
        self.remote = remote
        self.head = ""
        self.depth: int | None = None
        self.fetched: set[str] = set()
        self.fetches: list[str] = []

    async def get_remote_default_branch(self) -> str | None:
        return self.remote.default_branch

    async def get_remote_tags(self) -> list[GitTag]:
        return self.remote.tags

    async def get_remote_branch_head(self, branch: str) -> str | None:
        return self.remote.branches.get(branch)

    async def fetch_branch(self, branch: str, depth: int | None = None) -> None:
        self.head, self.depth = self.remote.branches[branch], depth
        self.fetches.append(f"fetch {depth or 'all'}")
        self._load()

    async def deepen_fetched(self, branch: str, by: int) -> None:
        assert self.depth is not None
        self.depth += by
        self.fetches.append(f"deepen {by}")
        self._load()

    def _load(self) -> None:
        level, self.fetched, distance = {self.head}, set(), 0
        while level and (self.depth is None or distance < self.depth):
            self.fetched |= level
            level = {parent for sha in level for parent in self.remote.parents(sha)} - self.fetched
            distance += 1

    async def is_fetched_shallow(self) -> bool:
        return any(parent not in self.fetched for sha in self.fetched for parent in self.remote.parents(sha))

    def _first_parent_history(self) -> list[str]:
        history, sha = [], self.head
        while sha in self.fetched:
            history.append(sha)
            parents = self.remote.parents(sha)
            sha = parents[0] if parents else ""
        return history

    def _ancestors(self, sha: str) -> set[str]:
        found, stack = set(), [sha]
        while stack:
            current = stack.pop()
            if current in self.fetched and current not in found:
                found.add(current)
                stack.extend(self.remote.parents(current))
        return found

    async def get_fetched_shas(self, first_parent: bool = False) -> set[str]:
        return set(self._first_parent_history()) if first_parent else set(self.fetched)

    async def get_fetched_commits(self, since: str | None = None, first_parent: bool = False) -> list[GitCommit]:
        assert first_parent
        excluded = self._ancestors(since) if since else set()
        return [self.remote.commits[sha][0] for sha in self._first_parent_history() if sha not in excluded]

    async def delete_workspace(self) -> None:
        pass


@pytest.fixture
def remote() -> FakeRemote:
    remote = FakeRemote()
    for i in range(3):
        remote.commit(f"commit {i}")
    remote.tags = [GitTag(name="v1.0.0", sha=remote.branches["trunk"])]
    return remote


class FakeCommitStore:
    """In-memory stand-in for the commit methods of SourceCodeCRUD."""

    def __init__(self) -> None:
        self.rows: dict[str, list[tuple[int, GitCommit]]] = {}
        self.writes: list[str] = []

    def messages(self, branch: str) -> list[str]:
        return [commit.message for _, commit in sorted(self.rows.get(branch, []), key=lambda row: row[0])]

    def positions(self, branch: str) -> list[int]:
        return sorted(position for position, _ in self.rows.get(branch, []))

    async def get_head_commit_sha(self, source_code_id, branch: str) -> str | None:
        rows = sorted(self.rows.get(branch, []), key=lambda row: row[0])
        return rows[0][1].sha if rows else None

    async def replace_commits(self, source_code_id, branch: str, commits: list[GitCommit]) -> None:
        self.writes.append(f"replace {len(commits)}")
        self.rows[branch] = list(enumerate(commits))

    async def prepend_commits(self, source_code_id, branch: str, commits: list[GitCommit]) -> None:
        self.writes.append(f"prepend {len(commits)}")
        lowest = min((position for position, _ in self.rows.get(branch, [])), default=0)
        first = lowest - len(commits)
        self.rows.setdefault(branch, []).extend((first + i, commit) for i, commit in enumerate(commits))

    async def delete_commits(self, source_code_id, branch: str | None = None) -> None:
        self.writes.append(f"delete {branch or 'all'}")
        self.rows = {name: rows for name, rows in self.rows.items() if branch is not None and name != branch}

    async def delete_commits_except(self, source_code_id, branch: str) -> None:
        self.rows = {name: rows for name, rows in self.rows.items() if name == branch}

    async def refresh(self, source_code) -> None:
        pass


def _task(source_code: SourceCode, git: FakeGitClient, store: FakeCommitStore) -> SourceCodeTask:
    entity_logger = Mock()
    entity_logger.save_log = AsyncMock()
    task = SourceCodeTask(
        session=AsyncMock(),
        crud_source_code=cast(Any, store),
        source_code_instance=source_code,
        task_service=AsyncMock(),
        logger=entity_logger,
        user=Mock(identifier="tester"),
        event_sender=AsyncMock(),
        action=ModelActions.SYNC,
        workspace_root="/nonexistent",
    )

    async def init_workspace() -> None:
        task.git_client = cast(Any, git)

    task.init_workspace = init_workspace
    task.get_source_code_data = AsyncMock()
    return task


async def _sync(remote: FakeRemote, store: FakeCommitStore, source_code: SourceCode | None = None) -> FakeGitClient:
    git = FakeGitClient(remote)
    await _task(source_code or _source_code(), git, store).start_pipeline()
    return git


class TestSourceCodeCommitSync:
    async def test_first_sync_stores_full_history(self, remote: FakeRemote):
        source_code = _source_code()
        store = FakeCommitStore()

        git = await _sync(remote, store, source_code)

        assert source_code.status == ModelStatus.DONE
        assert source_code.default_branch == "trunk"
        assert source_code.git_tag_shas == {"v1.0.0": remote.branches["trunk"]}
        assert git.fetches == ["fetch all"]
        assert store.writes == ["replace 3"]
        assert store.messages("trunk") == ["commit 2", "commit 1", "commit 0"]

    async def test_unchanged_branch_writes_nothing(self, remote: FakeRemote):
        store = FakeCommitStore()
        await _sync(remote, store)

        git = await _sync(remote, store)

        assert git.fetches == []
        assert store.writes == ["replace 3"]

    async def test_new_commits_are_prepended(self, remote: FakeRemote):
        store = FakeCommitStore()
        await _sync(remote, store)
        remote.commit("commit 3")
        remote.commit("commit 4", description="Why commit 4\nwas needed")

        git = await _sync(remote, store)

        assert git.fetches == ["fetch 50"]
        assert store.writes == ["replace 3", "prepend 2"]
        assert store.messages("trunk") == ["commit 4", "commit 3", "commit 2", "commit 1", "commit 0"]
        # Existing rows keep their positions; new ones go below them.
        assert store.positions("trunk") == [-2, -1, 0, 1, 2]
        newest = min(store.rows["trunk"], key=lambda row: row[0])[1]
        assert newest.description == "Why commit 4\nwas needed"

    async def test_commits_of_merged_branches_are_not_stored(self, remote: FakeRemote):
        store = FakeCommitStore()
        await _sync(remote, store)
        feature = remote.commit("feature work", branch="topic", parents=[remote.branches["trunk"]])
        trunk_work = remote.commit("trunk work")
        remote.commit("merge topic", parents=[trunk_work, feature])

        await _sync(remote, store)

        assert store.writes == ["replace 3", "prepend 2"]
        assert store.messages("trunk") == ["merge topic", "trunk work", "commit 2", "commit 1", "commit 0"]

    async def test_rewritten_history_is_stored_again(self, remote: FakeRemote):
        store = FakeCommitStore()
        await _sync(remote, store)
        first = next(sha for sha, (commit, _) in remote.commits.items() if commit.message == "commit 0")
        remote.commit("rewritten", parents=[first])

        git = await _sync(remote, store)

        assert git.fetches == ["fetch 50"]
        assert store.writes == ["replace 3", "replace 2"]
        assert store.messages("trunk") == ["rewritten", "commit 0"]

    async def test_history_deeper_than_the_first_fetch(self, remote: FakeRemote, monkeypatch):
        monkeypatch.setattr("application.source_codes.task.INCREMENTAL_FETCH_DEPTH", 1)
        store = FakeCommitStore()
        await _sync(remote, store)
        for i in range(3, 8):
            remote.commit(f"commit {i}")

        git = await _sync(remote, store)

        assert git.fetches == ["fetch 1", "deepen 1", "deepen 2", "deepen 4"]
        assert store.writes == ["replace 3", "prepend 5"]
        assert store.messages("trunk") == [f"commit {i}" for i in range(7, -1, -1)]

    async def test_stored_head_reached_only_through_a_merge(self, remote: FakeRemote, monkeypatch):
        monkeypatch.setattr("application.source_codes.task.INCREMENTAL_FETCH_DEPTH", 1)
        store = FakeCommitStore()
        await _sync(remote, store)
        stored_head = remote.branches["trunk"]
        # trunk is fast-forwarded to a branch that merged it, so the stored head is a second parent.
        topic_work = remote.commit("topic work", branch="topic", parents=remote.parents(stored_head))
        remote.commit("merge trunk into topic", parents=[topic_work, stored_head])

        git = await _sync(remote, store)

        assert git.fetches[-1] != "fetch 1"
        assert store.writes == ["replace 3", "prepend 2"]
        assert store.messages("trunk")[:2] == ["merge trunk into topic", "topic work"]

    async def test_commits_of_previous_default_branch_are_dropped(self, remote: FakeRemote):
        store = FakeCommitStore()
        store.rows["old-default"] = []

        await _sync(remote, store)

        assert list(store.rows) == ["trunk"]

    async def test_repository_without_default_branch(self, remote: FakeRemote):
        source_code = _source_code()
        store = FakeCommitStore()
        await _sync(remote, store, source_code)
        remote.default_branch = None
        remote.tags = []

        git = await _sync(remote, store, source_code)

        assert source_code.status == ModelStatus.DONE
        assert source_code.default_branch is None
        assert source_code.git_tag_shas == {}
        assert git.fetches == []
        assert store.writes == ["replace 3", "delete all"]
        assert store.rows == {}

    async def test_default_branch_without_commits(self, remote: FakeRemote):
        store = FakeCommitStore()
        await _sync(remote, store)
        remote.default_branch = "unborn"

        await _sync(remote, store)

        assert store.writes == ["replace 3", "delete unborn"]
        assert store.rows == {}

    async def test_failure_marks_error(self, remote: FakeRemote):
        source_code = _source_code()
        git = FakeGitClient(remote)
        git.get_remote_default_branch = AsyncMock(side_effect=ShellExecutionError("fatal: repository not found"))
        task = _task(source_code, git, FakeCommitStore())

        with pytest.raises(ShellExecutionError):
            await task.start_pipeline()
        await task.make_failed()

        assert source_code.status == ModelStatus.ERROR


def _stored_commit(message: str) -> SourceCodeCommit:
    return SourceCodeCommit(
        sha="a" * 40,
        branch="main",
        position=0,
        message=message,
        description="",
        author_name="Dev",
        author_email="dev@example.com",
        authored_at=datetime.now(),
    )


class TestGetCommits:
    async def test_adds_links(self, mock_source_code_service, mock_source_code_crud):
        mock_source_code_crud.get_by_id.return_value = _source_code(source_code_url="git@github.com:org/repo.git")
        mock_source_code_crud.get_commits = AsyncMock(return_value=[_stored_commit("Fix login")])

        commits = await mock_source_code_service.get_commits(uuid4())

        assert commits[0].url == f"https://github.com/org/repo/commit/{'a' * 40}"
        assert commits[0].short_sha == "aaaaaaa"

    async def test_links_authors_to_users_by_email(self, mock_source_code_service, mock_source_code_crud):
        mock_source_code_crud.get_by_id.return_value = _source_code()
        commit = _stored_commit("Fix login")
        commit.author_email = "Dev@Example.com"
        mock_source_code_crud.get_commits = AsyncMock(return_value=[commit])
        user = _source_code().creator
        mock_source_code_crud.get_users_by_emails = AsyncMock(return_value={"dev@example.com": user})

        commits = await mock_source_code_service.get_commits(uuid4())

        mock_source_code_crud.get_users_by_emails.assert_awaited_once_with({"Dev@Example.com"})
        assert commits[0].author is not None
        assert commits[0].author.id == user.id
