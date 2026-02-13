import logging
from typing import Any

from core.audit_logs.handler import AuditLogHandler
from core.auth_providers.model import AuthProviderDTO
from core.constants.model import ModelActions
from core.errors import EntityNotFound
from core.users.functions import user_is_super_admin
from core.utils.event_sender import EventSender
from core.utils.model_tools import model_db_dump
from .crud import AuthProviderCRUD
from .schema import AuthProviderCreate, AuthProviderResponse, AuthProviderUpdate
from core.users.model import UserDTO


logger = logging.getLogger(__name__)


def validate_configuration(provider_to_update: AuthProviderUpdate, provider_from_db: AuthProviderDTO) -> None:
    if not provider_to_update.configuration:
        return

    # update secret field if new value is provided
    secrets = provider_from_db.configuration.get_secrets()
    for secret in secrets:
        new_value = getattr(provider_to_update.configuration, secret[0], None)
        if new_value is None:
            raise ValueError(f"Secret field '{secret[0]}' is required for auth provider '{provider_from_db.name}'")

        if "***" in new_value.get_decrypted_value():
            # if masked value is provided, we should not update it
            setattr(provider_to_update.configuration, secret[0], secret[1])
            continue


class AuthProviderService:
    """
    AuthProviderService implements all required business-logic. It uses additional services and utils as helpers
    e.g. AuthProviderCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: AuthProviderCRUD,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud: AuthProviderCRUD = crud
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, auth_provider_id: str) -> AuthProviderResponse | None:
        auth_provider = await self.crud.get_by_id(auth_provider_id)
        if auth_provider is None:
            return None
        return AuthProviderResponse.model_validate(auth_provider)

    async def get_all(self, **kwargs) -> list[AuthProviderResponse]:
        auth_providers = await self.crud.get_all(**kwargs)
        return [AuthProviderResponse.model_validate(auth_provider) for auth_provider in auth_providers]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(self, auth_provider: AuthProviderCreate, requester: UserDTO) -> AuthProviderResponse:
        """
        Create a new auth_provider.
        :param auth_provider: AuthProviderCreate to create
        :param requester: User who creates the auth_provider
        :return: Created auth_provider
        """

        body = model_db_dump(auth_provider)
        body["created_by"] = requester.id
        new_auth_provider = await self.crud.create(body)
        result = await self.crud.get_by_id(new_auth_provider.id)

        await self.audit_log_handler.create_log(new_auth_provider.id, requester.id, ModelActions.CREATE)
        response = AuthProviderResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return response

    async def update(
        self, auth_provider_id: str, auth_provider: AuthProviderUpdate, requester: UserDTO
    ) -> AuthProviderResponse:
        """
        Update an existing auth_provider.
        :param auth_provider_id: ID of the auth_provider to update
        :param auth_provider: AuthProvider to update
        :param requester: User who updates the auth_provider
        :return: Updated auth_provider
        """

        auth_provider_from_db = await self.crud.get_by_id(auth_provider_id)

        if not auth_provider_from_db:
            raise EntityNotFound("AuthProvider not found")

        await self.audit_log_handler.create_log(auth_provider_from_db.id, requester.id, ModelActions.UPDATE)
        if auth_provider.enabled is False:
            dependencies = await self.crud.count(filter={"enabled": True})
            if dependencies <= 1:
                raise ValueError("Cannot disable single provider")

        auth_provider_pydantic = AuthProviderDTO.model_validate(auth_provider_from_db)
        validate_configuration(auth_provider, auth_provider_pydantic)
        body = model_db_dump(auth_provider)

        updated_auth_provider = await self.crud.update(auth_provider_from_db, body)

        response = AuthProviderResponse.model_validate(updated_auth_provider)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return response

    async def delete(self, auth_provider_id: str, requester: UserDTO) -> None:
        existing_auth_provider = await self.crud.get_by_id(auth_provider_id)
        if not existing_auth_provider:
            raise EntityNotFound("AuthProvider not found")

        if existing_auth_provider.enabled is True:
            raise ValueError("Provider must be disabled before deletion")

        await self.crud.delete(existing_auth_provider)

    async def get_actions(self, auth_provider_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the auth_provider.
        :param auth_provider_id: ID of the auth_provider
        :return: List of actions
        """
        if await user_is_super_admin(requester) is False:
            return []

        auth_provider = await self.crud.get_by_id(auth_provider_id)
        if not auth_provider:
            raise EntityNotFound("AuthProvider not found")
        actions: list[str] = [ModelActions.EDIT, ModelActions.DELETE]
        return actions
