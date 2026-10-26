import logging
import os
import re
import shutil
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from core.tools.shell_client import ShellScriptClient

logger = logging.getLogger(__name__)

# Refs and paths are taken from Terraform module sources, which come from
# user-controlled .tf files. Validating them defensively avoids argument
# injection against `git fetch`/`git show` (e.g. a ref like
# "--upload-pack=evil").
_GIT_REF_RE = re.compile(r"^[A-Za-z0-9_./\-]+$")
_GIT_PATH_RE = re.compile(r"^[A-Za-z0-9_./\-]+$")


def _validate_git_ref(ref: str) -> None:
    if not ref or ref.startswith("-") or ".." in ref.split("/") or not _GIT_REF_RE.match(ref):
        raise ValueError(f"invalid git ref: {ref!r}")


def _validate_git_path(path: str) -> None:
    if not path or path.startswith("-") or ".." in path.split("/") or not _GIT_PATH_RE.match(path):
        raise ValueError(f"invalid git path: {path!r}")


_FIELD_SEP = "\x1f"
_RECORD_SEP = "\x1e"
_COMMIT_FORMAT = "%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1e"


class GitCommit(BaseModel):
    sha: str
    author_name: str
    author_email: str
    authored_at: datetime
    message: str
    description: str = ""


def parse_ls_remote_symref(output: str) -> str | None:
    for line in output.splitlines():
        if line.startswith("ref: ") and line.endswith("\tHEAD"):
            ref = line.removeprefix("ref: ").split("\t", 1)[0]
            return ref.removeprefix("refs/heads/")
    return None


class GitTag(BaseModel):
    name: str
    sha: str


def parse_ls_remote_tags(output: str) -> list[GitTag]:
    # Annotated tags are listed twice; the peeled "^{}" line holds the commit.
    shas: dict[str, str] = {}
    for line in output.splitlines():
        parts = line.split("\t", 1)
        if len(parts) != 2 or not parts[1].startswith("refs/tags/"):
            continue
        sha, ref = parts
        name = ref.removeprefix("refs/tags/")
        if name.endswith("^{}"):
            shas[name.removesuffix("^{}")] = sha
        else:
            _ = shas.setdefault(name, sha)
    return [GitTag(name=name, sha=sha) for name, sha in shas.items()]


def parse_git_log(output: str) -> list[GitCommit]:
    commits: list[GitCommit] = []
    for record in output.split(_RECORD_SEP):
        parts = record.lstrip("\n").split(_FIELD_SEP, 5)
        if len(parts) != 6:
            continue
        sha, author_name, author_email, authored_at, message, description = parts
        commits.append(
            GitCommit(
                sha=sha,
                author_name=author_name,
                author_email=author_email,
                authored_at=datetime.fromisoformat(authored_at),
                message=message,
                description=description.strip(),
            )
        )
    return commits


class GitClient:
    logger: logging.Logger | Any = logger

    def __init__(
        self, git_url: str, workspace_path: str, repo_name: str, environment_variables: dict[str, str]
    ) -> None:
        self.git_url: str = git_url
        self.destination_dir: str = f"{workspace_path}/{repo_name}"
        self.workspace_path: str = workspace_path
        self.repo_name: str = repo_name
        self.environment_variables: dict[str, str] = environment_variables

    async def _run_git_command(self, command_args: str | list[str], workspace_path: str) -> str:
        shell_client = ShellScriptClient(
            command="git",
            command_args=command_args,
            environment_variables=self.environment_variables,
            workspace_path=workspace_path,
        )
        shell_client.logger = self.logger
        return await shell_client.run_shell_command()

    async def clone(self):
        """
        Clone the whole repository to the destination directory.
        """
        self.logger.info(f"Cloning repository to {self.destination_dir}")
        _ = await self._run_git_command(f"clone {self.git_url} {self.destination_dir}", self.workspace_path)

    async def clone_branch(self, branch: str):
        """
        Clone a specific branch of the repository to the destination directory.
        """
        self.logger.info(f"Cloning branch {branch} of repository to {self.destination_dir}")

        if branch.startswith("origin/"):
            branch = branch.removeprefix("origin/")
        elif branch.startswith("refs/heads/"):
            branch = branch.removeprefix("refs/heads/")
        elif branch.startswith("refs/tags/"):
            branch = branch.removeprefix("refs/tags/")

        command_args = f"clone -q --depth 1 --single-branch --branch {branch} {self.git_url} {self.destination_dir}"
        _ = await self._run_git_command(command_args, self.workspace_path)

    async def fetch_ref(self, ref: str) -> str:
        """Fetch a specific ref into the existing (shallow) clone and return
        its resolved commit SHA. The clone's working tree is not modified —
        the commit is reachable via the returned SHA (and via FETCH_HEAD).

        Raises if the ref can't be fetched (missing, no auth, etc.).
        """
        _validate_git_ref(ref)
        self.logger.info(f"Fetching ref {ref} into {self.destination_dir}")
        _ = await self._run_git_command(["fetch", "--depth", "1", "origin", ref], self.destination_dir)
        sha = await self._run_git_command(["rev-parse", "FETCH_HEAD"], self.destination_dir)
        return sha.strip()

    async def list_files_at_ref(self, ref: str, subpath: str) -> list[str]:
        """List file paths at <ref>:<subpath>, returned as paths from repo root."""
        _validate_git_ref(ref)
        _validate_git_path(subpath)
        out = await self._run_git_command(["ls-tree", "-r", "--name-only", ref, "--", subpath], self.destination_dir)
        return [line for line in out.splitlines() if line.strip()]

    async def read_file_at_ref(self, ref: str, path: str) -> str:
        """Return the content of a single file at <ref>:<path>."""
        _validate_git_ref(ref)
        _validate_git_path(path)
        return await self._run_git_command(["show", f"{ref}:{path}"], self.destination_dir)

    async def get_remote_default_branch(self) -> str | None:
        out = await self._run_git_command(["ls-remote", "--symref", self.git_url, "HEAD"], self.workspace_path)
        return parse_ls_remote_symref(out)

    async def get_remote_tags(self) -> list[GitTag]:
        out = await self._run_git_command(
            ["ls-remote", "--tags", "--sort=-version:refname", self.git_url], self.workspace_path
        )
        return parse_ls_remote_tags(out)

    async def get_remote_branch_head(self, branch: str) -> str | None:
        _validate_git_ref(branch)
        out = await self._run_git_command(["ls-remote", self.git_url, f"refs/heads/{branch}"], self.workspace_path)
        for line in out.splitlines():
            parts = line.split("\t", 1)
            if len(parts) == 2 and parts[1] == f"refs/heads/{branch}":
                return parts[0]
        return None

    async def fetch_branch(self, branch: str, depth: int | None = None) -> None:
        _validate_git_ref(branch)
        _ = await self._run_git_command(["init", "--bare", "-q", self.destination_dir], self.workspace_path)
        fetch_args = ["fetch", "-q", "--no-tags", "--filter=tree:0"]
        if depth is not None:
            fetch_args.append(f"--depth={depth}")
        _ = await self._run_git_command([*fetch_args, self.git_url, f"refs/heads/{branch}"], self.destination_dir)

    async def deepen_fetched(self, branch: str, by: int) -> None:
        _validate_git_ref(branch)
        _ = await self._run_git_command(
            ["fetch", "-q", "--no-tags", "--filter=tree:0", f"--deepen={by}", self.git_url, f"refs/heads/{branch}"],
            self.destination_dir,
        )

    async def is_fetched_shallow(self) -> bool:
        out = await self._run_git_command(["rev-parse", "--is-shallow-repository"], self.destination_dir)
        return out.strip() == "true"

    async def _log_fetched(
        self, revision: str, log_format: str, limit: int | None = None, first_parent: bool = False
    ) -> str:
        # Written to a file because the shell client logs every stdout line.
        log_file = os.path.join(self.workspace_path, "commits.log")
        log_args = ["log", f"--format={log_format}", f"--output={log_file}"]
        if limit is not None:
            log_args.append(f"-n{limit}")
        if first_parent:
            log_args.append("--first-parent")
        try:
            _ = await self._run_git_command([*log_args, revision], self.destination_dir)
            with open(log_file, encoding="utf-8", errors="replace") as f:
                return f.read()
        finally:
            if os.path.exists(log_file):
                os.remove(log_file)

    async def get_fetched_shas(self, first_parent: bool = False) -> set[str]:
        return set((await self._log_fetched("FETCH_HEAD", "%H", first_parent=first_parent)).split())

    async def get_fetched_commits(
        self, since: str | None = None, limit: int | None = None, first_parent: bool = False
    ) -> list[GitCommit]:
        if since is not None:
            _validate_git_ref(since)
        revision = f"{since}..FETCH_HEAD" if since else "FETCH_HEAD"
        return parse_git_log(await self._log_fetched(revision, _COMMIT_FORMAT, limit, first_parent=first_parent))

    async def delete_workspace(self):
        shutil.rmtree(self.destination_dir, ignore_errors=True)
        logger.info(f"Workspace {self.destination_dir} is cleaned up")

    async def get_repo_tags(self) -> list[str]:
        """
        Get all tags from the repository, sorted by tag creation time.
        Lightweight tags will fall back to the commit time.
        """
        raw_output = await self._run_git_command(
            "for-each-ref refs/tags --sort=-taggerdate --sort=-creatordate --format=%(refname:short)",
            self.destination_dir,
        )
        tags = raw_output.strip().split("\n")
        tags_list = [tag.strip() for tag in tags if tag.strip()]
        self.logger.info(f"Found {len(tags_list)} tags in the repository")
        return tags_list

    async def get_repo_tag_messages(self) -> dict[str, Any]:
        """
        Get all tags with their messages from the repository, sorted by tag creation time.
        Lightweight tags will fall back to the commit time.
        """
        raw_output = await self._run_git_command(
            "for-each-ref refs/tags --sort=-taggerdate --sort=-creatordate --format=%(refname:short):::%(subject)",
            self.destination_dir,
        )
        tags = raw_output.strip().split("\n")
        tags_list: dict[str, Any] = {}
        for tag in tags:
            if not tag.strip():
                continue
            parts = tag.split(":::")
            tag_name = parts[0].strip() if len(parts) > 0 else ""
            subject = parts[1].strip() if len(parts) > 1 else ""
            tags_list.update({tag_name: subject})
        self.logger.info(f"Found {len(tags_list.keys())} tags with messages in the repository")
        return tags_list

    async def checkout(self, ref: str) -> None:
        """
        Checkout a specific reference (branch or tag) in the repository.
        :param ref: The reference to checkout (branch name or tag name).
        """
        _ = await self._run_git_command(f"checkout -q {ref}", self.destination_dir)
        self.logger.info(f"Checked out {ref}")

    async def checkout_to_new_branch(self, new_branch_name: str, base_branch: str = "main") -> None:
        """
        Checkout to a new branch based on the specified base branch.
        :param new_branch_name: The name of the new branch to create and checkout.
        :param base_branch: The base branch to create the new branch from (default is 'main').
        """
        self.logger.info(f"Creating and checking out to new branch {new_branch_name} from {base_branch}")
        _ = await self._run_git_command(f"checkout -B {new_branch_name} {base_branch}", self.destination_dir)

    async def add_changes(self) -> None:
        """
        Add changes in the repository to the staging area.
        """
        self.logger.info("Adding changes to staging area")
        _ = await self._run_git_command("add -A", self.destination_dir)

    async def has_changes(self) -> bool:
        """
        Check if there are any changes in the repository to commit.
        :return: True if there are changes, False otherwise.
        """
        status_output = await self._run_git_command(["status", "--porcelain"], self.destination_dir)
        return bool(status_output.strip())

    async def commit_changes(
        self, commit_message: str, user_email: str | None = None, user_name: str | None = None
    ) -> bool:
        """
        Commit changes in the repository with the specified commit message.
        :param commit_message: The commit message to use for the commit.
        :return: True if changes were committed, False if there was nothing to commit.
        """
        if user_email is None:
            user_email = "ik@infrakitchen.io"
        if user_name is None:
            user_name = "ik"

        if not await self.has_changes():
            self.logger.info("No changes to commit - working tree is clean")
            return False

        self.logger.info(f"Committing changes with message: {commit_message}")
        _ = await self._run_git_command(["config", "user.email", user_email], self.destination_dir)
        _ = await self._run_git_command(["config", "user.name", user_name], self.destination_dir)
        _ = await self._run_git_command(["commit", "-am", commit_message], self.destination_dir)
        return True

    async def push(self, branch: str = "main", force: bool = False) -> None:
        """
        Push changes to the remote repository on the specified branch.
        :param branch: The branch to push changes to (default is 'main').
        :param force: Whether to force push the changes (default is False).
        """
        self.logger.info(f"Pushing changes to remote repository on branch {branch}")
        if force:
            _ = await self._run_git_command(f"push -f origin {branch}", self.destination_dir)
        else:
            _ = await self._run_git_command(f"push origin {branch}", self.destination_dir)

    async def get_repo_branches(self) -> list[str]:
        """
        Get all local and remote branch names from the repository.
        The output will include local branches, and remote branches prefixed with 'remotes/origin/'.
        """
        raw_output = await self._run_git_command("branch -a", self.destination_dir)

        # Split the output by newline characters
        branches = raw_output.strip().split("\n")

        # Process each branch name
        branch_names_list: list[str] = []
        for branch_line in branches:
            stripped_line = branch_line.strip()
            if not stripped_line:
                continue  # Skip empty lines

            # Skip unnecessary branches
            if stripped_line.startswith("* "):
                continue
            elif " -> " in stripped_line:
                continue
            else:
                if stripped_line.startswith("remotes/"):
                    branch_name = stripped_line.split("remotes/")[-1]
                else:
                    branch_name = stripped_line
                branch_names_list.append(branch_name)

        self.logger.info(f"Found {len(branch_names_list)} branches in the repository")

        return branch_names_list

    async def get_repo_branch_messages(self) -> dict[str, Any]:
        """
        Get all branches with their latest commit messages from the repository.
        The output will include local branches, and remote branches prefixed with 'remotes/origin/'.
        """
        raw_output = await self._run_git_command(
            "for-each-ref refs/heads refs/remotes --sort=-committerdate --format=%(refname:short):::%(subject)",
            self.destination_dir,
        )
        branches = raw_output.strip().split("\n")
        branches_list: dict[str, Any] = {}
        for branch in branches:
            if not branch.strip():
                continue
            parts = branch.split(":::")
            branch_name = parts[0].strip() if len(parts) > 0 else ""
            subject = parts[1].strip() if len(parts) > 1 else ""
            if branch_name.startswith("remotes/"):
                branch_name = branch_name.split("remotes/")[-1]
            branches_list.update({branch_name: subject})
        self.logger.info(f"Found {len(branches_list.keys())} branches with messages in the repository")
        return branches_list
