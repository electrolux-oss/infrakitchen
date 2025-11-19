import logging
import os
from pathlib import Path
from tempfile import gettempdir
from typing import override
import asyncio

import aiofiles
import httpx

from application.integrations.schema import (
    GithubIntegrationConfig,
    GithubSshIntegrationConfig,
)
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr
from core.tools.git_client import GitClient
from .github_api import GithubApi

log = logging.getLogger("github_integration")


class GithubAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None = None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for GithubAuthentication")

        if not isinstance(config, GithubIntegrationConfig | GithubSshIntegrationConfig):
            if "github_ssh_private_key" in config:
                config = GithubSshIntegrationConfig.model_validate(config)
            else:
                config = GithubIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.github_ssh_key: EncryptedSecretStr | None = None
        self.github_user: str | None = None
        self.github_key: EncryptedSecretStr | None = None
        self.github_pat: EncryptedSecretStr | None = None

        if isinstance(config, GithubSshIntegrationConfig):
            self.logger.info("Using SSH key for Github authentication...")
            self.github_ssh_key = config.github_ssh_private_key

        elif isinstance(config, GithubIntegrationConfig):
            token_field = getattr(config, "github_token", None)
            if token_field:  # explicit PAT field
                self.logger.info("Using personal access token for Github authentication...")
                self.github_pat = token_field
            elif getattr(config, "github_client_id", None) and getattr(config, "github_client_secret", None):
                self.logger.info("Using username and token for Github authentication...")
                self.github_user = config.github_client_id
                self.github_key = config.github_client_secret
            elif getattr(config, "github_client_secret", None):
                self.logger.info("Using personal access token (client secret only) for Github authentication...")
                self.github_pat = config.github_client_secret
            else:
                self.logger.warning("No recognizable credentials found in GithubIntegrationConfig")

    async def verify_auth(self) -> None:
        """
        Verify credentials by calling the /user endpoint.
        Raises CloudWrongCredentials on any auth failure.
        """
        token = None
        if self.github_pat:
            token = self.github_pat.get_decrypted_value()
        elif self.github_user and self.github_key:
            token = self.github_key.get_decrypted_value()
        elif self.github_key:
            token = self.github_key.get_decrypted_value()
        if not token:
            return

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://api.github.com/user",
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
                )
            if r.status_code == 401:
                raise CloudWrongCredentials(message="Invalid GitHub token (401 Unauthorized).", metadata=[r.json()])
            if r.status_code != 200:
                raise CloudWrongCredentials(f"GitHub token validation failed (status {r.status_code}).")
            data = r.json()
            if "login" not in data:
                raise CloudWrongCredentials("GitHub token validation failed (missing login).")
            self.logger.info(f"Authenticated GitHub user: {data['login']}")
        except CloudWrongCredentials:
            raise
        except Exception as e:
            raise CloudWrongCredentials(f"GitHub token validation error: {e}") from e

    async def authenticate_github(self) -> None:
        if self.github_ssh_key:
            self.logger.info("Authenticating with Github using SSH key...")
            if self.workspace_root:
                tmp_filename = Path(self.workspace_root) / "ssh_key"
            else:
                tmp_filename = Path(gettempdir()) / "ssh_key"
            async with aiofiles.open(tmp_filename, mode="w") as af:
                _ = await af.write(
                    f"{self.github_ssh_key.get_decrypted_value().strip()}\n"
                )  # guarantee that there is a newline at the end
            os.chmod(tmp_filename, 0o600)
            self.environment_variables["GIT_SSH"] = f"{tmp_filename}"
            self.environment_variables["GIT_SSH_COMMAND"] = f"ssh -o StrictHostKeyChecking=no -i {tmp_filename}"
            self.logger.info(f"SSH key is written to {tmp_filename}")

        elif self.github_user and self.github_key:
            self.logger.info("Authenticating with GitHub using username + token (HTTPS)...")
            await self.verify_auth()

        elif self.github_pat:
            self.logger.info("Authenticating with GitHub using personal access token...")
            self.environment_variables["GITHUB_TOKEN"] = self.github_pat.get_decrypted_value()
            await self.verify_auth()

        elif self.github_key:
            self.logger.info("Authenticating with GitHub using token...")
            self.environment_variables["GITHUB_TOKEN"] = self.github_key.get_decrypted_value()
            await self.verify_auth()

        else:
            self.logger.error("No valid authentication method provided for GitHub.")
            raise CloudWrongCredentials("No valid authentication method provided for GitHub.")


class GithubProvider(IntegrationProvider, GithubAuthentication):
    __integration_provider_name__: str = "github"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    def _get_git_url(self, git_url: str) -> str:
        """Get the git URL for the Github integration."""
        if "https://" in git_url:
            if self.github_user and self.github_key:
                return git_url.replace(
                    "https://", f"https://{self.github_user}:{self.github_key.get_decrypted_value()}@"
                )
            if self.github_pat:
                return git_url.replace("https://", f"https://{self.github_pat.get_decrypted_value()}@")
            if self.github_key:
                return git_url.replace("https://", f"https://{self.github_key.get_decrypted_value()}@")
        return git_url

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_github()

    @override
    async def verify_auth(self) -> None:
        await GithubAuthentication.verify_auth(self)

    @override
    async def get_api_client(self) -> GithubApi:
        return GithubApi(self.environment_variables)

    @override
    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> GitClient:
        """Get the git client for the Github integration."""

        git_client = GitClient(
            git_url=self._get_git_url(git_url),
            workspace_path=workspace_root,
            repo_name=repo_name,
            environment_variables=self.environment_variables,
        )
        git_client.logger = self.logger
        return git_client

    @override
    async def is_valid(self) -> bool:
        await self.verify_auth()
        return True


class GithubSshProvider(IntegrationProvider, GithubAuthentication):
    """GitHub provider for SSH integration."""

    __integration_provider_name__: str = "github_ssh"

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_github()

    @override
    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> GitClient:
        """Get the git client for the GitHub integration."""
        git_client = GitClient(
            git_url=git_url,
            workspace_path=workspace_root,
            repo_name=repo_name,
            environment_variables=self.environment_variables,
        )
        git_client.logger = self.logger
        return git_client

    @override
    async def is_valid(self) -> bool:
        """
        Validate SSH key configuration by testing actual SSH connection to GitHub.
        """
        try:
            if not self.github_ssh_key:
                raise CloudWrongCredentials("SSH private key is required for GitHub SSH integration.")

            ssh_key_content = self.github_ssh_key.get_decrypted_value().strip()
            if not ssh_key_content:
                raise CloudWrongCredentials("SSH private key cannot be empty.")

            # Basic SSH key format validation
            if not (ssh_key_content.startswith("-----BEGIN") and "PRIVATE KEY-----" in ssh_key_content):
                raise CloudWrongCredentials("Invalid SSH private key format. Key must be in PEM format.")

            # Create temporary SSH key file
            if self.workspace_root:
                tmp_filename = Path(self.workspace_root) / "ssh_test_key"
            else:
                tmp_filename = Path(gettempdir()) / "ssh_test_key"

            try:
                # Write SSH key to temporary file
                async with aiofiles.open(tmp_filename, mode="w") as af:
                    await af.write(f"{ssh_key_content.strip()}\n")
                os.chmod(tmp_filename, 0o600)

                # Test SSH connection to GitHub
                process = await asyncio.create_subprocess_exec(
                    "ssh",
                    "-o",
                    "StrictHostKeyChecking=no",
                    "-o",
                    "UserKnownHostsFile=/dev/null",
                    "-o",
                    "ConnectTimeout=10",
                    "-i",
                    str(tmp_filename),
                    "-T",
                    "git@github.com",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                stdout, stderr = await process.communicate()

                # GitHub SSH test returns exit code 1 on successful auth but no shell access
                # Look for success messages in stderr
                stderr_text = stderr.decode("utf-8").lower()
                stdout_text = stdout.decode("utf-8").lower()

                # Check for GitHub success indicators
                if (
                    "successfully authenticated" in stderr_text
                    or "you've successfully authenticated" in stderr_text
                    or "hi " in stderr_text
                ):
                    return True

                # Check for common SSH errors
                if (
                    "permission denied" in stderr_text
                    or "authentication failed" in stderr_text
                    or "access denied" in stderr_text
                ):
                    raise CloudWrongCredentials(
                        "SSH key authentication failed. Please verify the key is correctly added to your GitHub account."  # noqa
                    )

                if (
                    "connection refused" in stderr_text
                    or "connection timed out" in stderr_text
                    or "network is unreachable" in stderr_text
                ):
                    raise CloudWrongCredentials("Unable to connect to GitHub. Please check your network connectivity.")

                # If we get here, authentication might have succeeded but we got an unexpected response
                self.logger.warning(
                    f"SSH test completed with exit code {process.returncode}. stderr: {stderr_text}, stdout: {stdout_text}"  # noqa
                )

                # # For GitHub, exit code 1 with no explicit error usually means success
                if process.returncode == 1 and not any(
                    error in stderr_text for error in ["permission denied", "authentication failed", "access denied"]
                ):
                    return True

                raise CloudWrongCredentials(
                    "SSH connection test failed. Please verify your SSH key is correctly configured in GitHub."
                )

            finally:
                # Clean up temporary file
                if tmp_filename.exists():
                    tmp_filename.unlink()

        except CloudWrongCredentials:
            raise
        except Exception as e:
            raise CloudWrongCredentials(f"SSH key validation error: {e}") from e
