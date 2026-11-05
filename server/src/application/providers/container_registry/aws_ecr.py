import base64
import logging
from typing import Any, override

import botocore.exceptions
from aiobotocore.session import get_session

from application.integrations.schema import AWSECRIntegrationConfig, AWSIntegrationConfig
from application.providers.aws.aws_provider import AwsAuthentication
from core.adapters.provider_adapters import ContainerRegistryProvider, IntegrationProvider, RegistryCredentials
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, CloudWrongCredentials

log = logging.getLogger("aws_ecr_provider")


class AwsEcrProvider(IntegrationProvider, ContainerRegistryProvider):
    """Amazon ECR private registry.

    AWS credentials come either from a linked ``aws`` integration, whose configuration the caller
    resolves and passes as ``aws_configuration``, or from the ECR configuration itself.
    """

    __integration_provider_name__: str = "aws_ecr"
    __integration_provider_type__: str = "container_registry"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs: Any) -> None:
        self.logger = logger if logger else log

        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for AwsEcrProvider")
        self.configuration: AWSECRIntegrationConfig = AWSECRIntegrationConfig.model_validate(config)
        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self._credentials: RegistryCredentials | None = None

        aws_configuration: AWSIntegrationConfig | None = kwargs.get("aws_configuration")
        if self.configuration.aws_integration_id:
            if aws_configuration is None:
                raise CannotProceed(
                    f"AWS integration {self.configuration.aws_integration_id} linked to the registry was not resolved"
                )
        else:
            aws_configuration = AWSIntegrationConfig(
                aws_access_key_id=self.configuration.aws_access_key_id or "",
                aws_secret_access_key=self.configuration.aws_secret_access_key,  # pyright: ignore[reportArgumentType]
                aws_account=self.configuration.aws_account,
                aws_assumed_role_name=self.configuration.aws_assumed_role_name,
                aws_session_duration=self.configuration.aws_session_duration,
                aws_default_region=self.configuration.aws_region,
                aws_partition=self.configuration.aws_partition,
            )
        self.registry_host: str = self.configuration.registry_host_for_partition(aws_configuration.aws_partition)
        self._aws_authentication = AwsAuthentication(logger=logger, configuration=aws_configuration)

    @override
    async def authenticate(self, **kwargs: Any) -> None:
        await self._aws_authentication.get_account_session()
        aws_env = self._aws_authentication.environment_variables
        try:
            async with get_session().create_client(
                "ecr",
                region_name=self.configuration.aws_region,
                aws_access_key_id=aws_env["AWS_ACCESS_KEY_ID"],
                aws_secret_access_key=aws_env["AWS_SECRET_ACCESS_KEY"],
                aws_session_token=aws_env.get("AWS_SESSION_TOKEN"),
            ) as ecr_client:
                response: dict[str, Any] = await ecr_client.get_authorization_token()  # pyright: ignore[reportGeneralTypeIssues]
        except botocore.exceptions.ClientError as e:
            raise CloudWrongCredentials(
                "Failed to get an ECR authorization token",
                metadata=[{"cloud_message": str(e)}],
            ) from e

        authorization_data = response.get("authorizationData") or []
        if not authorization_data:
            raise CloudWrongCredentials("ECR returned no authorization data")

        token: str = authorization_data[0]["authorizationToken"]
        username, password = base64.b64decode(token).decode("utf-8").split(":", 1)
        self._credentials = RegistryCredentials(
            registry_host=self.registry_host,
            username=username,
            password=password,
            expires_at=authorization_data[0].get("expiresAt"),
        )
        self.logger.info(f"Fetched ECR authorization token for {self.registry_host}")

    @override
    async def get_registry_credentials(self) -> RegistryCredentials:
        if self._credentials is None:
            await self.authenticate()
        assert self._credentials is not None
        return self._credentials

    @override
    async def is_valid(self) -> bool:
        try:
            _ = await self.get_registry_credentials()
            return True
        except CloudWrongCredentials:
            raise
        except Exception as e:
            raise CloudWrongCredentials(
                "Failed to validate ECR connection",
                metadata=[{"cloud_message": str(e)}],
            ) from e
