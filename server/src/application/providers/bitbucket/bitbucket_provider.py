import logging
import os
from pathlib import Path
from tempfile import gettempdir
from typing import override
import asyncio

import aiofiles

from application.integrations.schema import BitbucketIntegrationConfig, BitbucketSshIntegrationConfig
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr
from core.tools.git_client import GitClient
from .bitbucket_api import BitbucketApi

log = logging.getLogger("bitbucket_integration")


class BitbucketAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None = None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for BitbucketAuthentication")

        if not isinstance(config, BitbucketIntegrationConfig | BitbucketSshIntegrationConfig):
            if "bitbucket_ssh_private_key" in config:
                config = BitbucketSshIntegrationConfig.model_validate(config)
            else:
                config = BitbucketIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.bitbucket_ssh_private_key: EncryptedSecretStr | None = None
        self.bitbucket_user: str | None = None
        self.bitbucket_key: EncryptedSecretStr | None = None
        if isinstance(config, BitbucketSshIntegrationConfig):
            self.bitbucket_ssh_private_key = config.bitbucket_ssh_private_key

        elif isinstance(config, BitbucketIntegrationConfig):
            self.bitbucket_user = config.bitbucket_user
            self.bitbucket_key = config.bitbucket_key

    async def authenticate_bitbucket(self) -> None:
        if self.bitbucket_ssh_private_key:
            self.logger.info("Authenticating with Bitbucket using SSH key...")
            if self.workspace_root:
                tmp_filename = Path(self.workspace_root) / "ssh_key"
            else:
                tmp_filename = Path(gettempdir()) / "ssh_key"
            async with aiofiles.open(tmp_filename, mode="w") as af:
                _ = await af.write(
                    f"{self.bitbucket_ssh_private_key.get_decrypted_value().strip()}\n"
                )  # guarantee that there is a newline at the end

            os.chmod(tmp_filename, 0o600)

            self.environment_variables["GIT_SSH"] = f"{tmp_filename}"
            self.environment_variables["GIT_SSH_COMMAND"] = f"ssh -o StrictHostKeyChecking=no -i {tmp_filename}"
            self.logger.info(f"SSH key is written to {tmp_filename}")

        elif self.bitbucket_user and self.bitbucket_key:
            self.logger.info("Authenticating with Bitbucket using username and password...")
            self.environment_variables["BITBUCKET_USER"] = self.bitbucket_user
            self.environment_variables["BITBUCKET_KEY"] = self.bitbucket_key.get_decrypted_value()
        elif self.bitbucket_key:
            self.logger.info("Authenticating with Bitbucket using API key...")
            self.environment_variables["BITBUCKET_API_KEY"] = self.bitbucket_key.get_decrypted_value()
        else:
            self.logger.error("No valid authentication method provided for Bitbucket.")
            raise CloudWrongCredentials("No valid authentication method provided for Bitbucket.")


class BitbucketProvider(IntegrationProvider, BitbucketAuthentication):
    __integration_provider_name__: str = "bitbucket"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    def _get_git_url(self, git_url: str) -> str:
        """Get the git URL for the Bitbucket integration."""
        if "https://" in git_url:
            if self.bitbucket_key:
                git_url = git_url.replace(
                    "https://", f"https://x-bitbucket-api-token-auth:{self.bitbucket_key.get_decrypted_value()}@"
                )
            else:
                self.logger.error("No valid authentication method provided for Bitbucket.")
                raise CloudWrongCredentials("No valid authentication method provided for Bitbucket.")

            return git_url
        else:
            return git_url

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_bitbucket()

    @override
    async def get_api_client(self) -> BitbucketApi:
        return BitbucketApi(self.environment_variables)

    @override
    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> GitClient:
        """Get the git client for the Bitbucket integration."""
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
        bitbucket_api_client = await self.get_api_client()
        try:
            return await bitbucket_api_client.get_user_orgs() is not None
        except Exception as e:
            raise CloudWrongCredentials(e) from e


class BitbucketSshProvider(IntegrationProvider, BitbucketAuthentication):
    """Bitbucket provider for SSH integration."""

    __integration_provider_name__: str = "bitbucket_ssh"

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_bitbucket()

    @override
    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> GitClient:
        """Get the git client for the Bitbucket integration."""
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
        Validate SSH key configuration by testing actual SSH connection to Bitbucket.
        """
        try:
            if not self.bitbucket_ssh_private_key:
                raise CloudWrongCredentials("SSH private key is required for Bitbucket SSH integration.")

            ssh_key_content = self.bitbucket_ssh_private_key.get_decrypted_value().strip()
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

                # Test SSH connection to Bitbucket
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
                    "git@bitbucket.org",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                stdout, stderr = await process.communicate()

                # Bitbucket SSH test returns exit code 0 on successful auth
                stderr_text = stderr.decode("utf-8").lower()
                stdout_text = stdout.decode("utf-8").lower()

                # Check for Bitbucket success indicators
                if (
                    process.returncode == 0
                    or "logged in as" in stderr_text
                    or "authenticated via ssh" in stderr_text
                    or "you can use git" in stderr_text
                ):
                    return True

                # Check for common SSH errors
                if (
                    "permission denied" in stderr_text
                    or "authentication failed" in stderr_text
                    or "access denied" in stderr_text
                ):
                    raise CloudWrongCredentials(
                        "SSH key authentication failed. Please verify the key is correctly added to your Bitbucket account."  # noqa
                    )

                if (
                    "connection refused" in stderr_text
                    or "connection timed out" in stderr_text
                    or "network is unreachable" in stderr_text
                ):
                    raise CloudWrongCredentials(
                        "Unable to connect to Bitbucket. Please check your network connectivity."
                    )

                # If we get here, check the output for any success indicators
                full_output = f"{stdout_text} {stderr_text}"
                if any(indicator in full_output for indicator in ["logged in", "authenticated", "you can use git"]):
                    return True

                self.logger.warning(
                    f"SSH test completed with exit code {process.returncode}. stderr: {stderr_text}, stdout: {stdout_text}"  # noqa
                )
                raise CloudWrongCredentials(
                    "SSH connection test failed. Please verify your SSH key is correctly configured in Bitbucket."
                )

            finally:
                # Clean up temporary file
                if tmp_filename.exists():
                    tmp_filename.unlink()

        except CloudWrongCredentials:
            raise
        except Exception as e:
            raise CloudWrongCredentials(f"SSH key validation error: {e}") from e
