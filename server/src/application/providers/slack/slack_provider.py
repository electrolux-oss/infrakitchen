import logging
import uuid
from typing import override
from jinja2 import Template

from application.integrations.schema import SlackIntegrationConfig
from core.adapters.provider_adapters import IntegrationProvider, NotificationProviderAdapter
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from .slack_api import SlackApi

log = logging.getLogger("slack_provider")


DEFAULT_SLACK_NOTIFICATION_TEMPLATE = """*{{ title or 'InfraKitchen Alert' }}* \
{% set status_normalized = (status or 'info') | lower %}\
{% if status_normalized in ['error', 'failed', 'failure'] %}❌\
{% elif status_normalized in ['success', 'ok', 'done'] %}✅\
{% elif status_normalized in ['warning', 'warn'] %}⚠️\
{% else %}ℹ️{% endif %}

> {{ (msg or '') | replace('\n', '\n> ') }}

*Details*
• *Entity:* `{{ entity_name or 'unknown' }}`
• *ID:* `{% if entity_id %}{{ entity_id }}{% else %}-{% endif %}`
"""


class SlackAuthentication:
    environment_variables: dict[str, str]
    logger: logging.Logger | EntityLogger = log
    workspace_root: str | None = None

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger = logger if logger else log

        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for SlackAuthentication")

        configuration = SlackIntegrationConfig.model_validate(config)
        self.environment_variables = kwargs.get("environment_variables", {})
        self.slack_bot_token: EncryptedSecretStr = configuration.slack_bot_token

    async def authenticate_slack(self) -> None:
        token = self.slack_bot_token.get_decrypted_value()
        if not token:
            raise CloudWrongCredentials("Slack bot token is missing")

        self.environment_variables["SLACK_BOT_TOKEN"] = token


class SlackProvider(IntegrationProvider, NotificationProviderAdapter, SlackAuthentication):
    __integration_provider_name__: str = "slack"
    __integration_provider_type__: str = "notification"
    __notification_provider_adapter_name__: str = "slack"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_slack()

    @override
    async def get_api_client(self) -> SlackApi:
        if not self.environment_variables.get("SLACK_BOT_TOKEN"):
            await self.authenticate_slack()
        return SlackApi(self.environment_variables)

    @override
    async def is_valid(self) -> bool:
        try:
            api_client = await self.get_api_client()
            _ = await api_client.auth_test()
            return True
        except CloudWrongCredentials:
            raise
        except Exception as e:
            raise CloudWrongCredentials(
                "Failed to validate Slack connection",
                metadata=[{"cloud_message": str(e)}],
            ) from e

    @override
    async def send_notification(self, **kwargs) -> None:
        channel = kwargs.get("channel")
        msg = kwargs.get("msg")

        payload = {
            "msg": msg,
            "title": kwargs.get("title"),
            "status": kwargs.get("status"),
            "entity_id": kwargs.get("entity_id"),
            "entity_name": kwargs.get("entity_name"),
        }

        if not channel:
            raise CannotProceed("Slack channel is required")
        if not msg:
            raise CannotProceed("Notification message is required")

        template_str = kwargs.get("template") or DEFAULT_SLACK_NOTIFICATION_TEMPLATE
        text = Template(template_str).render(**payload).strip()

        if not text:
            raise CannotProceed("Rendered Slack notification text is empty")

        try:
            api_client = await self.get_api_client()
            _ = await api_client.post_message(channel=channel, text=text)
        except CannotProceed:
            raise
        except Exception as e:
            raise CannotProceed(f"Failed to send Slack notification: {e}") from e


async def get_slack_client(integration_id: uuid.UUID | None, session: AsyncSession) -> SlackApi:
    from application.integrations.dependencies import get_integration_service

    service = get_integration_service(session=session)
    if not integration_id:
        integrations = await service.get_all(filter={"integration_provider": "slack"})
        if not integrations:
            raise ValueError("No Slack integrations found")
        elif len(integrations) > 1:
            raise ValueError("Multiple Slack integrations found, please specify integration_id")
        integration = integrations[0]
    else:
        integration = await service.get_by_id(integration_id)
    if not integration or integration.integration_provider != "slack":
        raise ValueError("Integration for Slack not found")

    provider = SlackProvider(configuration=integration.configuration)
    await provider.authenticate()
    return await provider.get_api_client()
