import logging
from typing import override

from application.integrations.schema import GitLabIntegrationConfig
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.tools.git_client import GitClient
from .gitlab_api import GitLabApi

log = logging.getLogger("gitlab_integration")  # TODO use __name__ instead


class GitLabProvider(IntegrationProvider):
    """Implement the GitLab provider."""

    __integration_provider_name__: str = "gitlab"
    __integration_provider_type__: str = "git"
    logger: logging.Logger | EntityLogger = log

    # TODO make a relevant __init__ in parent class to reduce boilerplate
    # TODO configuration / environment variables should be mandatory? or make a base class
    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger or log

        self.environment_variables = kwargs.get("environment_variables", {})

        if not (config := kwargs.get("configuration")):
            raise ValueError("Configuration is required for GitLabAuthentication")
        if not isinstance(config, GitLabIntegrationConfig):
            config = GitLabIntegrationConfig.model_validate(config)

        self.gitlab_server_url = config.gitlab_server_url
        self.gitlab_token = config.gitlab_token
        if self.gitlab_token:
            self.logger.info("Using private or personal token for GitLab authentication...")
        else:
            self.logger.warning("No recognizable credentials found in GitLabIntegrationConfig")

    @override
    async def authenticate(self, **kwargs) -> None:
        self.environment_variables["GITLAB_SERVER_URL"] = self.gitlab_server_url
        if self.gitlab_token:
            self.logger.info(f"Authenticating with {self.gitlab_server_url} using private or personal token...")
            self.environment_variables["GITLAB_TOKEN"] = self.gitlab_token.get_decrypted_value().strip()
            self.logger.info("GITLAB_TOKEN environment variable set")
        else:
            self.logger.error("No valid authentication method provided for GitLab.")
            raise CloudWrongCredentials("No valid authentication method provided for GitLab.")

    @override
    async def is_valid(self) -> bool:
        await self.verify_auth()
        return True

    @override
    async def verify_auth(self) -> None:
        """
        Verify credentials by calling the /user endpoint.
        Raises GitLab Python SDK any auth failure.
        """
        client = await self.get_api_client()
        # Check the token, see https://python-gitlab.readthedocs.io/en/stable/api-usage.html
        client.client.auth()

    @override
    async def get_api_client(self) -> GitLabApi:
        return GitLabApi(self.environment_variables)

    @override
    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> GitClient:
        """Get the git client for the GitLab integration."""
        git_client = GitClient(
            git_url=self._get_git_url(git_url),
            workspace_path=workspace_root,
            repo_name=repo_name,
            environment_variables=self.environment_variables,
        )
        git_client.logger = self.logger
        return git_client

    def _get_git_url(self, git_url: str) -> str:
        """Get the git URL for the GitLab integration."""
        if git_url.startswith("https://"):
            if token := self.gitlab_token:
                return git_url.replace("https://", f"https://oauth2:{token.get_decrypted_value()}@")
        return git_url
