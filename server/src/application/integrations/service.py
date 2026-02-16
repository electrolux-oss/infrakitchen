import logging
from typing import Any
from uuid import UUID


from core.models.encrypted_secret import EncryptedSecretStr
from core.adapters.functions import get_integration_adapter
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.database import to_dict
from core.errors import CloudWrongCredentials, DependencyError, EntityNotFound, EntityWrongState
from core.revisions.handler import RevisionHandler
from core.tasks.service import TaskEntityService
from core.users.functions import user_api_permission
from core.users.model import UserDTO
from core.utils.event_sender import EventSender
from core.utils.model_tools import model_db_dump
from .crud import IntegrationCRUD
from .model import Integration, IntegrationDTO
from .schema import IntegrationCreate, IntegrationResponse, IntegrationUpdate, IntegrationValidationResponse
from ..utils.constants import MASKED_VALUE

logger = logging.getLogger(__name__)


class IntegrationService:
    """
    IntegrationService implements all required business-logic. It uses additional services and utils as helpers
    e.g. IntegrationCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: IntegrationCRUD,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        task_service: TaskEntityService,
    ):
        self.crud: IntegrationCRUD = crud
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.task_service: TaskEntityService = task_service

    async def get_dto_by_id(self, integration_id: str | UUID) -> IntegrationDTO | None:
        integration = await self.crud.get_by_id(integration_id)
        if integration is None:
            return None
        return IntegrationDTO.model_validate(integration)

    async def get_by_id(self, integration_id: str | UUID) -> IntegrationResponse | None:
        integration = await self.crud.get_by_id(integration_id)
        if integration is None:
            return None
        return IntegrationResponse.model_validate(integration)

    async def get_all(self, **kwargs) -> list[IntegrationResponse]:
        integrations = await self.crud.get_all(**kwargs)
        return [IntegrationResponse.model_validate(integration) for integration in integrations]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(self, integration: IntegrationCreate, requester: UserDTO) -> IntegrationResponse:
        """
        Create a new integration.
        :param integration: IntegrationCreate to create
        :param requester: User who creates the integration
        :return: Created integration
        """
        cloud_providers = ["aws", "azurerm", "gcp", "mongodb_atlas", "datadog"]
        source_code_providers = [
            "github",
            "bitbucket",
            "azure_devops",
            "azure_devops_ssh",
            "github_ssh",
            "bitbucket_ssh",
        ]
        if integration.integration_type == "cloud":
            if integration.integration_provider not in cloud_providers:
                raise ValueError(f"Invalid integration provider, must be one of {', '.join(cloud_providers)}")
        elif integration.integration_type == "git":
            if integration.integration_provider not in source_code_providers:
                raise ValueError(f"Invalid integration provider, must be one of {', '.join(source_code_providers)}")

        body = model_db_dump(integration)
        body["created_by"] = requester.id
        new_integration = await self.crud.create(body)
        new_integration.status = ModelStatus.ENABLED
        result = await self.crud.get_by_id(new_integration.id)

        await self.revision_handler.handle_revision(new_integration)
        await self.audit_log_handler.create_log(new_integration.id, requester.id, ModelActions.CREATE)
        response = IntegrationResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return response

    async def update(
        self, integration_id: str, integration: IntegrationUpdate, requester: UserDTO
    ) -> IntegrationResponse:
        """
        Update an existing integration.
        :param integration_id: ID of the integration to update
        :param integration: Integration to update
        :param requester: User who updates the integration
        :return: Updated integration
        """
        existing_integration = await self.crud.get_by_id(integration_id)

        if not existing_integration:
            raise EntityNotFound("Integration not found")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_integration)

        self.validate_configuration(integration_update=integration, existing_integration=existing_integration)
        body = model_db_dump(integration)

        await self.crud.update(existing_integration, body)

        await self.audit_log_handler.create_log(existing_integration.id, requester.id, ModelActions.UPDATE)
        await self.revision_handler.handle_revision(existing_integration)
        await self.crud.refresh(existing_integration)
        response = IntegrationResponse.model_validate(existing_integration)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return response

    async def patch(self, integration_id, body: PatchBodyModel, requester: UserDTO) -> IntegrationResponse:
        """
        Patch an existing integration.
        :param integration_id: ID of the integration to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the integration
        :return: Patched integration
        """
        existing_integration = await self.crud.get_by_id(integration_id)
        if not existing_integration:
            raise EntityNotFound("Integration not found")

        await self.audit_log_handler.create_log(existing_integration.id, requester.id, body.action)
        match body.action:
            case ModelActions.DISABLE:
                existing_integration.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing_integration.status == ModelStatus.DISABLED:
                    existing_integration.status = ModelStatus.ENABLED
                else:
                    raise EntityWrongState("Integration is already enabled")
            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = IntegrationResponse.model_validate(existing_integration)
        await self.event_sender.send_event(response, body.action)
        return response

    async def delete(self, integration_id: str, requester: UserDTO) -> None:
        existing_integration = await self.crud.get_by_id(integration_id)
        if not existing_integration:
            raise EntityNotFound("Integration not found")

        if existing_integration.status == ModelStatus.ENABLED:
            raise EntityWrongState("Integration must be disabled before deletion")

        dependencies = await self.crud.get_dependencies(existing_integration)
        dependencies_to_raise = []
        if dependencies:
            for dependency in dependencies:
                dependencies_to_raise.append(
                    {
                        "id": dependency.id,
                        "name": dependency.name,
                        "_entity_name": dependency.type,
                    }
                )

        if dependencies_to_raise:
            raise DependencyError(
                message=f"Cannot delete integration, it is used by {len(dependencies_to_raise)} entities",
                metadata=dependencies_to_raise,
            )

        await self.audit_log_handler.create_log(integration_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(integration_id)
        await self.task_service.delete_by_entity_id(integration_id)
        await self.crud.delete(existing_integration)

    async def get_actions(self, integration_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the integration.
        :param integration_id: ID of the integration
        :return: List of actions
        """
        apis = await user_api_permission(requester, "integration")
        if not apis:
            return []
        requester_permissions = [apis["api:integration"]]

        if "write" not in requester_permissions and "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        integration = await self.crud.get_by_id(integration_id)
        if not integration:
            raise EntityNotFound("Integration not found")

        if integration.status == ModelStatus.ENABLED:
            if "admin" in requester_permissions:
                actions.append(ModelActions.EDIT)
                actions.append(ModelActions.DISABLE)
        if integration.status == ModelStatus.DISABLED:
            if "admin" in requester_permissions:
                actions.append(ModelActions.DELETE)
                actions.append(ModelActions.ENABLE)

        return actions

    def validate_configuration(self, integration_update: IntegrationUpdate, existing_integration: Integration) -> None:
        if not integration_update.configuration:
            return

        existing_integration_config = IntegrationDTO.model_validate(existing_integration)
        existing_secrets = existing_integration_config.configuration.get_secrets()

        for secret in existing_secrets:
            secret_name = secret[0]
            existing_secret_value = secret[1]

            new_secret_value: EncryptedSecretStr | None = getattr(integration_update.configuration, secret_name, None)
            if new_secret_value is None:
                raise ValueError(
                    f"Secret field '{secret_name}' is required for integration '{integration_update.name}'"
                )

            if MASKED_VALUE in new_secret_value.get_decrypted_value():
                # If masked value is provided (displayed FE form value) in the update request,
                # the existing secret shouldn't be updated
                setattr(integration_update.configuration, secret_name, existing_secret_value)

    async def validate(self, integration_config: Any, integration_provider: str) -> IntegrationValidationResponse:
        try:
            provider_adapter_instance = await get_integration_adapter(integration_provider, integration_config)
            await provider_adapter_instance.authenticate()
            integration_is_valid = await provider_adapter_instance.is_valid()
            message = "Validation successful" if integration_is_valid else "Validation failed"
        except CloudWrongCredentials as e:
            raise e
        except Exception as e:
            logger.error(f"Unexpected error during connection validation: {e}", exc_info=True)
            integration_is_valid = False
            message = f"Unexpected error: {str(e)}"
        return IntegrationValidationResponse(is_valid=integration_is_valid, message=message)
