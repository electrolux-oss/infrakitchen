import logging
import shutil
from typing import Any

from core.tools.shell_client import ShellScriptClient

logger = logging.getLogger(__name__)


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

        if "/" in branch:
            branch = branch.split("/")[-1]

        command_args = f"clone -q --depth 1 --single-branch --branch {branch} {self.git_url} {self.destination_dir}"
        _ = await self._run_git_command(command_args, self.workspace_path)

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

    async def commit_changes(
        self, commit_message: str, user_email: str | None = None, user_name: str | None = None
    ) -> None:
        """
        Commit changes in the repository with the specified commit message.
        :param commit_message: The commit message to use for the commit.
        """
        if user_email is None:
            user_email = "ik@infrakitchen.io"
        if user_name is None:
            user_name = "ik"

        self.logger.info(f"Committing changes with message: {commit_message}")
        _ = await self._run_git_command(["config", "user.email", user_email], self.destination_dir)
        _ = await self._run_git_command(["config", "user.name", user_name], self.destination_dir)
        _ = await self._run_git_command(["commit", "-am", commit_message], self.destination_dir)

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
