import logging
from typing import override

from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.tools.git_client import GitClient

log = logging.getLogger("public_integration")


class PublicAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None = None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log
        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})

    async def verify_auth(self) -> None:
        self.logger.info("No authentication to verify for public provider.")
        return

    async def authenticate_public(self) -> None:
        self.logger.info("No authentication required for public provider.")
        return


class PublicProvider(IntegrationProvider, PublicAuthentication):
    __integration_provider_name__: str = "public"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    def _get_git_url(self, git_url: str) -> str:
        return git_url

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_public()

    @override
    async def verify_auth(self) -> None:
        await self.verify_auth()

    @override
    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> GitClient:
        """Get the git client for the public repos."""

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
        try:
            await self.verify_auth()
            return True
        except CloudWrongCredentials:
            raise
