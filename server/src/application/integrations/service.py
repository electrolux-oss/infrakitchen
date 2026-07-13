import json
import logging
from typing import Any
from uuid import UUID


from core.models.encrypted_secret import EncryptedSecretStr
from core.adapters.functions import get_integration_adapter
from application.providers.gcp import gcp_oidc
from application.integrations.schema import GCPIntegrationConfig
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.database import FieldSpec
from core.constants.model import ModelActions
from core.database import to_dict
from core.errors import CloudWrongCredentials, DependencyError, EntityNotFound, EntityWrongState
from core.permissions.schema import EntityPolicyCreate
from core.permissions.service import PermissionService
from core.revisions.handler import RevisionHandler
from core.tasks.service import TaskEntityService
from core.users.model import UserDTO
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump
from .crud import IntegrationCRUD
from .functions import get_integration_actions
from .model import Integration, IntegrationDTO
from .schema import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationUpdate,
    IntegrationValidationResponse,
)
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
        permission_service: PermissionService,
    ):
        self.crud: IntegrationCRUD = crud
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.task_service: TaskEntityService = task_service
        self.permission_service: PermissionService = permission_service

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

    async def get_all_dto(self, **kwargs) -> list[IntegrationDTO]:
        integrations = await self.crud.get_all(**kwargs)
        return [IntegrationDTO.model_validate(integration) for integration in integrations]

    async def query_by_id(self, integration_id: str | UUID, fields: FieldSpec | None = None) -> Integration | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(integration_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Integration]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create_integration(self, integration: IntegrationCreate, requester: UserDTO) -> Integration:
        """
        Create a new integration and return the ORM model.
        :param integration: IntegrationCreate to create
        :param requester: User who creates the integration
        :return: Created integration ORM model
        """
        cloud_providers = ["aws", "azurerm", "gcp", "mongodb_atlas", "datadog"]
        source_code_providers = [
            "github",
            "gitlab",
            "bitbucket",
            "azure_devops",
            "azure_devops_ssh",
            "github_ssh",
            "bitbucket_ssh",
            "git_public",
        ]
        notification_providers = ["slack"]
        if integration.integration_type == "cloud":
            if integration.integration_provider not in cloud_providers:
                raise ValueError(f"Invalid integration provider, must be one of {', '.join(cloud_providers)}")
        elif integration.integration_type == "git":
            if integration.integration_provider not in source_code_providers:
                raise ValueError(f"Invalid integration provider, must be one of {', '.join(source_code_providers)}")
        elif integration.integration_type == "notification":
            if integration.integration_provider not in notification_providers:
                raise ValueError(f"Invalid integration provider, must be one of {', '.join(notification_providers)}")

        self._ensure_gcp_oidc_signing_material(getattr(integration, "configuration", None))
        body = model_db_dump(integration)
        body["created_by"] = requester.id
        new_integration = await self.crud.create(body)
        new_integration.status = ModelStatus.ENABLED
        result = await self.crud.get_by_id(new_integration.id)

        if not result:
            raise EntityNotFound("Integration not found after creation")

        await self.revision_handler.handle_revision(new_integration)
        await self.audit_log_handler.create_log(
            new_integration.id, requester.id, ModelActions.CREATE, revision_number=new_integration.revision_number
        )
        response = IntegrationResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        await self.permission_service.create_entity_policy(
            EntityPolicyCreate(
                user_id=requester.id,
                entity_id=new_integration.id,
                entity_name="integration",
                action="admin",
            ),
            requester=requester,
            reload_permission=False,
        )
        await self.permission_service.casbin_enforcer.send_reload_event()
        return result

    async def update_integration(
        self, integration_id: str, integration: IntegrationUpdate, requester: UserDTO
    ) -> Integration:
        """
        Update an existing integration and return the ORM model.
        :param integration_id: ID of the integration to update
        :param integration: Integration to update
        :param requester: User who updates the integration
        :return: Updated integration ORM model
        """
        existing_integration = await self.crud.get_by_id(integration_id)

        if not existing_integration:
            raise EntityNotFound("Integration not found")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_integration)

        self.validate_configuration(integration_update=integration, existing_integration=existing_integration)
        self._carry_over_gcp_oidc_signing_material(integration, existing_integration)
        self._ensure_gcp_oidc_signing_material(integration.configuration)
        body = model_db_dump(integration, exclude_defaults=True, exclude_none=True)

        # configuration is a replacement JSON object – it must be serialized in
        # full (including discriminator/default fields like integration_provider,
        # aws_default_region, etc.) so the stored value stays valid.  The
        # exclude_defaults used above strips those nested defaults, so
        # re-serialize configuration without that flag when it was provided.
        if integration.configuration is not None:
            body["configuration"] = model_db_dump(integration.configuration)

        if not has_field_changes(body, existing_integration):
            raise ValueError("No changes detected; the integration is already up to date.")

        await self.crud.update(existing_integration, body)

        await self.revision_handler.handle_revision(existing_integration)
        await self.audit_log_handler.create_log(
            existing_integration.id,
            requester.id,
            ModelActions.UPDATE,
            revision_number=existing_integration.revision_number,
        )
        await self.crud.refresh(existing_integration)
        response = IntegrationResponse.model_validate(existing_integration)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return existing_integration

    async def patch_action(self, integration_id: str, body: PatchBodyModel, requester: UserDTO) -> Integration:
        """
        Patch an existing integration and return the ORM model.
        :param integration_id: ID of the integration to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the integration
        :return: Patched integration ORM instance
        """
        existing_integration = await self.crud.get_by_id(integration_id)
        if not existing_integration:
            raise EntityNotFound("Integration not found")

        await self.audit_log_handler.create_log(
            existing_integration.id, requester.id, body.action, revision_number=existing_integration.revision_number
        )
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
        return existing_integration

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
                        "entityName": dependency.type,
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
        await self.permission_service.delete_entity_permissions("integration", integration_id)
        await self.crud.delete(existing_integration)

    async def get_actions(self, integration_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the integration.
        :param integration_id: ID of the integration
        :return: List of actions
        """
        integration = await self.crud.get_by_id(integration_id, fields={"status": None})
        if not integration:
            raise EntityNotFound("Integration not found")
        return await get_integration_actions(requester, integration_id, integration.status)

    def validate_configuration(self, integration_update: IntegrationUpdate, existing_integration: Integration) -> None:
        if not integration_update.configuration:
            return

        existing_integration_config = IntegrationDTO.model_validate(existing_integration)
        existing_secrets = existing_integration_config.configuration.get_secrets()
        new_secret_names = {secret_name for secret_name, _ in integration_update.configuration.get_secrets()}

        for secret in existing_secrets:
            secret_name = secret[0]
            existing_secret_value = secret[1]

            if secret_name not in new_secret_names:
                continue

            new_secret_value: EncryptedSecretStr | None = getattr(integration_update.configuration, secret_name, None)
            if new_secret_value is None:
                raise ValueError(
                    f"Secret field '{secret_name}' is required for integration '{integration_update.name}'"
                )

            if MASKED_VALUE in new_secret_value.get_decrypted_value():
                # If masked value is provided (displayed FE form value) in the update request,
                # the existing secret shouldn't be updated
                setattr(integration_update.configuration, secret_name, existing_secret_value)

    async def validate(
        self, integration_config: Any, integration_provider: str, integration_id: str | UUID | None = None
    ) -> IntegrationValidationResponse:
        try:
            provider_adapter_instance = await get_integration_adapter(
                integration_provider, integration_config, integration_id=integration_id
            )
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

    # GCP OIDC signing keypair handling: generate on creation, preserve on update
    @staticmethod
    def _ensure_gcp_oidc_signing_material(config: Any) -> None:
        """Generate a per-integration OIDC signing keypair when needed.

        For GCP integrations using the ``workload_identity_federation_oidc`` auth method, a private
        signing key (encrypted) and its public JWK are required. When they are missing (new
        integration, or switching into OIDC mode) a fresh RSA keypair is generated in place on the
        config. Existing keys are preserved.
        """
        if not isinstance(config, GCPIntegrationConfig):
            return
        if config.gcp_auth_method != "workload_identity_federation_oidc":
            return
        if config.gcp_oidc_signing_private_key and config.gcp_oidc_signing_public_jwk:
            return

        private_pem, public_jwk = gcp_oidc.generate_signing_keypair()
        config.gcp_oidc_signing_private_key = EncryptedSecretStr(private_pem)
        config.gcp_oidc_signing_public_jwk = json.dumps(public_jwk)

    @staticmethod
    def _carry_over_gcp_oidc_signing_material(
        integration_update: IntegrationUpdate, existing_integration: Integration
    ) -> None:
        """Preserve an existing GCP OIDC keypair across updates.

        The private signing key is never sent back by the frontend, so when an integration stays in
        (or is edited while in) OIDC mode we copy the previously generated keypair from the stored
        config instead of regenerating it (which would invalidate the published JWKS).
        """
        new_config = integration_update.configuration
        if not isinstance(new_config, GCPIntegrationConfig):
            return
        if new_config.gcp_auth_method != "workload_identity_federation_oidc":
            return
        if new_config.gcp_oidc_signing_private_key and new_config.gcp_oidc_signing_public_jwk:
            return

        existing_config = IntegrationDTO.model_validate(existing_integration).configuration
        if not isinstance(existing_config, GCPIntegrationConfig):
            return
        if existing_config.gcp_oidc_signing_private_key and existing_config.gcp_oidc_signing_public_jwk:
            new_config.gcp_oidc_signing_private_key = existing_config.gcp_oidc_signing_private_key
            new_config.gcp_oidc_signing_public_jwk = existing_config.gcp_oidc_signing_public_jwk
