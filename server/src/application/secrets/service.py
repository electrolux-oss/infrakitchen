import logging
from typing import Any
from uuid import UUID

from application.integrations.schema import IntegrationResponse
from application.integrations.service import IntegrationService
from application.secrets.model import Secret, SecretDTO
from application.utils.constants import MASKED_VALUE
from core.adapters.functions import get_integration_adapter, get_secret_adapter
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from core.database import FieldSpec, to_dict
from core.errors import CloudWrongCredentials, DependencyError, EntityNotFound, EntityWrongState
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump
from .crud import SecretCRUD
from .functions import get_secret_actions
from .schema import CustomSecretConfig, SecretCreate, SecretResponse, SecretUpdate, SecretValidationResponse
from core.users.model import UserDTO

from core.constants import ModelStatus

logger = logging.getLogger(__name__)


class SecretService:
    """
    SecretService implements all required business-logic. It uses additional services and utils as helpers
    e.g. SecretCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: SecretCRUD,
        integration_service: IntegrationService,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud: SecretCRUD = crud
        self.integration_service: IntegrationService = integration_service
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, secret_id: str) -> SecretResponse | None:
        secret = await self.crud.get_by_id(secret_id)
        if secret is None:
            return None
        return SecretResponse.model_validate(secret)

    async def get_all(self, **kwargs) -> list[SecretResponse]:
        secrets = await self.crud.get_all(**kwargs)
        return [SecretResponse.model_validate(secret) for secret in secrets]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, secret_id: str | UUID, fields: FieldSpec | None = None) -> Secret | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(secret_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Secret]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def get_actions(self, secret_id: str | UUID, requester: UserDTO) -> list[str]:
        secret = await self.crud.get_by_id(secret_id, fields={"status": None})
        if not secret:
            raise EntityNotFound("Secret not found")
        return await get_secret_actions(requester, secret.status)

    async def create_secret(self, secret: SecretCreate, requester: UserDTO) -> Secret:
        """
        Create a new secret and return the ORM model.
        :param secret: SecretCreate to create
        :param requester: User who creates the secret
        :return: Created secret ORM instance
        """
        secret_providers = ["aws", "gcp", "custom"]
        if secret.secret_type == "tofu":
            if secret.secret_provider not in secret_providers:
                raise ValueError("Invalid secret provider, must be one of 'aws', 'gcp', 'custom'")

        body = model_db_dump(secret)
        body["created_by"] = requester.id

        if secret.secret_provider != "custom":
            if not secret.integration_id:
                raise ValueError("Integration ID is required to create a secret")
            integration = await self.integration_service.get_by_id(secret.integration_id)
            if not integration:
                raise EntityNotFound("Integration not found")

            if integration.status != ModelStatus.ENABLED:
                raise DependencyError(
                    "Integration must be enabled to create a secret", metadata=[integration.model_dump()]
                )
        else:
            body["integration_id"] = None

        new_secret = await self.crud.create(body)
        new_secret.status = ModelStatus.ENABLED
        result = await self.crud.get_by_id(new_secret.id)

        if not result:
            raise EntityNotFound("Secret not found after creation")

        await self.revision_handler.handle_revision(new_secret)
        await self.audit_log_handler.create_log(
            new_secret.id, requester.id, ModelActions.CREATE, revision_number=new_secret.revision_number
        )
        response = SecretResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return result

    async def update_secret(self, secret_id: str, secret: SecretUpdate, requester: UserDTO) -> Secret:
        """
        Update an existing secret and return the ORM model.
        :param secret_id: ID of the secret to update
        :param secret: Secret to update
        :param requester: User who updates the secret
        :return: Updated secret ORM instance
        """
        existing_secret = await self.crud.get_by_id(secret_id)

        if not existing_secret:
            raise EntityNotFound("Secret not found")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_secret)
        self.validate_configuration(secret_update=secret, existing_secret=existing_secret)

        body = model_db_dump(secret, exclude_unset=True, exclude_none=True)

        if not has_field_changes(body, existing_secret):
            raise ValueError("No changes detected; the secret is already up to date.")

        await self.crud.update(existing_secret, body)

        await self.revision_handler.handle_revision(existing_secret)
        await self.audit_log_handler.create_log(
            secret_id, requester.id, ModelActions.UPDATE, revision_number=existing_secret.revision_number
        )
        await self.crud.refresh(existing_secret)

        response = SecretResponse.model_validate(existing_secret)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return existing_secret

    async def patch_action_secret(self, secret_id: str, body: PatchBodyModel, requester: UserDTO) -> Secret:
        """
        Patch an existing secret and return the ORM model.
        :param secret_id: ID of the secret to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the secret
        :return: Patched secret ORM instance
        """
        existing_secret = await self.crud.get_by_id(secret_id)
        if not existing_secret:
            raise EntityNotFound("Secret not found")

        await self.audit_log_handler.create_log(
            existing_secret.id, requester.id, body.action, revision_number=existing_secret.revision_number
        )
        match body.action:
            case ModelActions.DISABLE:
                existing_secret.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing_secret.status == ModelStatus.DISABLED:
                    existing_secret.status = ModelStatus.ENABLED
                else:
                    raise EntityWrongState("Secret is already enabled")
            case _:
                raise ValueError("Invalid action")

        response = SecretResponse.model_validate(existing_secret)
        await self.event_sender.send_event(response, body.action)
        return existing_secret

    async def delete(self, secret_id: str, requester: UserDTO) -> None:
        existing_secret = await self.crud.get_by_id(secret_id)
        if not existing_secret:
            raise EntityNotFound("Secret not found")

        if existing_secret.status == ModelStatus.ENABLED:
            raise EntityWrongState("Secret must be disabled before deletion")

        dependencies = await self.crud.get_dependencies(existing_secret)
        dependencies_to_raise = []
        if dependencies:
            for dependency in dependencies:
                dependencies_to_raise.append(
                    {
                        "id": dependency.id,
                        "name": dependency.name,
                        "entityName": dependency.type,
                    }
                )

        if dependencies_to_raise:
            raise DependencyError(
                message=f"Cannot delete secret, it is used by {len(dependencies_to_raise)} entities",
                metadata=dependencies_to_raise,
            )

        await self.audit_log_handler.create_log(secret_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(secret_id)
        await self.crud.delete(existing_secret)

    def validate_configuration(self, secret_update: SecretUpdate, existing_secret: Secret) -> None:
        existing_secret_config = SecretDTO.model_validate(existing_secret)
        if not isinstance(existing_secret_config.configuration, CustomSecretConfig):
            return

        if not isinstance(secret_update.configuration, CustomSecretConfig):
            return

        existing_secrets = existing_secret_config.configuration.get_secrets()
        existing_secret_dict = {secret[0]: secret[1] for secret in existing_secrets}

        for secret_value in secret_update.configuration.secrets:
            if secret_value.name in existing_secret_dict:
                existing_value = existing_secret_dict[secret_value.name]
                if MASKED_VALUE in secret_value.value.get_decrypted_value():
                    secret_value.value = existing_value

    async def validate(self, secret: SecretResponse | SecretCreate) -> SecretValidationResponse:
        if secret.secret_provider == "custom":
            raise ValueError("Custom secret provider does not require validation")

        try:
            integration: IntegrationResponse | None = None
            if isinstance(secret, SecretCreate):
                if not secret.integration_id:
                    raise ValueError("Integration ID is required for validation")

                integration = await self.integration_service.get_by_id(secret.integration_id)
                if not integration:
                    raise EntityNotFound("Integration not found")
            elif isinstance(secret, SecretResponse):
                if not secret.integration:
                    raise ValueError("Integration is required for validation")
                integration = await self.integration_service.get_by_id(secret.integration.id)

            if not integration:
                raise EntityNotFound("Integration not found")

            integration_adapter_instance = await get_integration_adapter(
                integration.integration_provider,
                integration.model_dump()["configuration"],
                integration_id=integration.id,
            )
            await integration_adapter_instance.authenticate()
            environment_variables = integration_adapter_instance.environment_variables

            provider_adapter_instance = await get_secret_adapter(
                provider=secret.secret_provider,
                config=secret.configuration.model_dump(),
                environment_variables=environment_variables,
            )
            integration_is_valid = await provider_adapter_instance.is_valid()
            return SecretValidationResponse(is_valid=True, message=integration_is_valid)
        except CloudWrongCredentials as e:
            raise e
        except Exception as e:
            logger.error(f"Unexpected error during connection validation: {e}", exc_info=True)
            integration_is_valid = False
            message = f"Unexpected error: {str(e)}"
        return SecretValidationResponse(is_valid=integration_is_valid, message=message)
