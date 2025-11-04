import asyncio
import logging
import os
from pathlib import Path
from tempfile import gettempdir
from typing import override

import aiofiles

from application.integrations.schema import AzureReposIntegrationConfig, AzureReposSshIntegrationConfig
from application.providers.azurerm.azure_devops_api import AzureDevopsApi
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr
from core.tools.git_client import GitClient

log = logging.getLogger(__name__)


class AzureRepoAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for AzureRepoAuthentication")

        if not isinstance(config, AzureReposSshIntegrationConfig | AzureReposIntegrationConfig):
            if "azure_ssh_private_key" in config:
                config = AzureReposSshIntegrationConfig.model_validate(config)
            else:
                config = AzureReposIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.azure_ssh_private_key: EncryptedSecretStr | None = None
        self.azure_access_token: EncryptedSecretStr | None = None
        self.azure_organization: str | None = None
        self.workspace_root: str | None = kwargs.get("workspace_root", None)

        if isinstance(config, AzureReposIntegrationConfig):
            self.azure_access_token = config.azure_access_token
            self.azure_organization = config.organization

        if isinstance(config, AzureReposSshIntegrationConfig):
            self.azure_ssh_private_key = config.azure_ssh_private_key

    async def authenticate_azure_devops(self) -> None:
        if self.azure_ssh_private_key:
            self.logger.info("Authenticating with Azure Repos using SSH key...")
            if self.workspace_root:
                tmp_filename = Path(self.workspace_root) / "ssh_key"
            else:
                tmp_filename = Path(gettempdir()) / "ssh_key"
            async with aiofiles.open(tmp_filename, mode="w") as af:
                _ = await af.write(
                    f"{self.azure_ssh_private_key.get_decrypted_value().strip()}\n"
                )  # guarantee that there is a newline at the end

            os.chmod(tmp_filename, 0o600)

            self.environment_variables["GIT_SSH"] = f"{tmp_filename}"
            self.environment_variables["GIT_SSH_COMMAND"] = f"ssh -o StrictHostKeyChecking=no -i {tmp_filename}"
            self.logger.info(f"SSH key is written to {tmp_filename}")

        elif self.azure_access_token and self.azure_organization:
            # TODO: to be implemented
            self.logger.info("Authenticating with Azure Repos using personal access token...")
            self.environment_variables["AZURE_TOKEN"] = self.azure_access_token.get_decrypted_value()
            self.environment_variables["AZURE_ORGANIZATION"] = self.azure_organization
        else:
            self.logger.error("No valid authentication method provided for Azure Repos.")
            raise CloudWrongCredentials("No valid authentication method provided for Azure Repos.")


class AzureRepoSourceCode(IntegrationProvider, AzureRepoAuthentication):
    __integration_provider_name__: str = "azure_devops"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    def _get_git_url(self, git_url: str) -> str:
        """Get the git URL for the Azure Repos integration."""
        if "https://" in git_url:
            if self.azure_access_token and self.azure_organization:
                git_url = git_url.replace(
                    "https://", f"https://{self.azure_organization}:{self.azure_access_token.get_decrypted_value()}@"
                )
            elif self.azure_access_token:
                git_url = git_url.replace("https://", f"https://{self.azure_access_token.get_decrypted_value()}@")
            return git_url
        else:
            return git_url

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_azure_devops()

    @override
    async def get_api_client(self) -> AzureDevopsApi:
        return AzureDevopsApi(self.environment_variables)

    @override
    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> GitClient:
        """Get the git client for the Azure Devops integration."""

        git_client = GitClient(
            git_url=self._get_git_url(git_url),
            workspace_path=workspace_root,
            repo_name=repo_name,
            environment_variables=self.environment_variables,
        )
        git_client.logger = self.logger
        return git_client

    @override
    async def is_valid(self):
        azure_devops_api = AzureDevopsApi(self.environment_variables)
        try:
            return await azure_devops_api.get_projects() is not None
        except Exception as e:
            raise CloudWrongCredentials(f"Azure Devops validation failed: {e}") from e


class AzureRepoSourceCodeSsh(IntegrationProvider, AzureRepoAuthentication):
    __integration_provider_name__: str = "azure_devops_ssh"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_azure_devops()

    @override
    async def get_api_client(self) -> AzureDevopsApi:
        return AzureDevopsApi(self.environment_variables)

    @override
    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> GitClient:
        """Get the git client for the Azure Devops integration."""
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
        Validate SSH key configuration by testing actual SSH connection to Azure Repos.
        """
        try:
            if not self.azure_ssh_private_key:
                raise CloudWrongCredentials("SSH private key is required for Azure SSH integration.")

            ssh_key_content = self.azure_ssh_private_key.get_decrypted_value().strip()
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

                # Test SSH connection to Azure Repos
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
                    "git@ssh.dev.azure.com",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                stdout, stderr = await process.communicate()

                # Azure SSH test returns exit code 1 on successful auth but no shell access
                # Look for success messages in stderr
                stderr_text = stderr.decode("utf-8").lower()
                stdout_text = stdout.decode("utf-8").lower()

                # Check for Azure Repos success indicators
                if "shell access is not supported" in stderr_text:
                    return True

                # Check for common SSH errors
                if (
                    "permission denied" in stderr_text
                    or "authentication failed" in stderr_text
                    or "access denied" in stderr_text
                ):
                    raise CloudWrongCredentials(
                        "SSH key authentication failed. Please verify the key is correctly added to your Azure Repos account."  # noqa
                    )

                if (
                    "connection refused" in stderr_text
                    or "connection timed out" in stderr_text
                    or "network is unreachable" in stderr_text
                ):
                    raise CloudWrongCredentials("Unable to connect to Azure. Please check your network connectivity.")

                # If we get here, authentication might have succeeded but we got an unexpected response
                self.logger.warning(
                    f"SSH test completed with exit code {process.returncode}. stderr: {stderr_text}, stdout: {stdout_text}"  # noqa
                )

                # # For Azure Repos, exit code 1 with no explicit error usually means success
                if process.returncode == 1 and not any(
                    error in stderr_text for error in ["permission denied", "authentication failed", "access denied"]
                ):
                    return True

                raise CloudWrongCredentials(
                    f"SSH connection test failed. Please verify your SSH key is correctly configured in Azure. stderr: {stderr_text}"  # noqa
                )

            finally:
                # Clean up temporary file
                if tmp_filename.exists():
                    tmp_filename.unlink()

        except CloudWrongCredentials:
            raise
        except Exception as e:
            raise CloudWrongCredentials(f"SSH key validation error: {e}") from e
