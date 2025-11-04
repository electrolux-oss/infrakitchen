import logging
from typing import Any
from uuid import UUID

from core.audit_logs.handler import AuditLogHandler
from core.constants import ModelActions
from core.errors import EntityNotFound
from core.models.encrypted_secret import EncryptedSecretStr
from core.users.functions import user_is_super_admin
from core.utils.model_tools import model_db_dump
from core.utils.password_manager import hash_new_password
from .crud import UserCRUD
from .schema import UserCreate, UserCreateWithProvider, UserResponse, UserUpdate
from core.users.model import UserDTO


logger = logging.getLogger(__name__)


class UserService:
    """
    UserService implements all required business-logic. It uses additional services and utils as helpers
    e.g. UserCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: UserCRUD,
        audit_log_handler: AuditLogHandler | None = None,
    ):
        self.crud: UserCRUD = crud
        self.audit_log_handler: AuditLogHandler | None = audit_log_handler

    async def get_dto_by_id(self, user_id: str | UUID) -> UserDTO | None:
        user = await self.crud.get_by_id(user_id)
        if user is None:
            return None
        return UserDTO.model_validate(user)

    async def get_by_id(self, user_id: str | UUID) -> UserResponse | None:
        user = await self.crud.get_by_id(user_id)
        if user is None:
            return None
        return UserResponse.model_validate(user)

    async def get_all(self, **kwargs) -> list[UserResponse]:
        users = await self.crud.get_all(**kwargs)
        return [UserResponse.model_validate(user) for user in users]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def get_user_by_identifier(self, identifier: str) -> UserDTO | None:
        result = await self.crud.get_one(filter={"identifier": identifier})
        if result:
            return UserDTO.model_validate(result)
        return None

    async def create_user_if_not_exists(self, user: UserCreateWithProvider) -> UserDTO:
        result = await self.get_user_by_identifier(user.identifier)
        if not result:
            query = await self.crud.create(model_db_dump(user))
            if not query:
                raise ValueError("User could not be created")
            created_user = await self.crud.get_by_id(query.id)
            result = UserDTO.model_validate(created_user)

        return UserDTO.model_validate(result)

    async def create(self, user: UserCreate, requester: UserDTO) -> UserResponse:
        """
        Create a new user.
        Only ik_service_account provider is allowed.
        :param user: UserCreate to create
        :param requester: User who creates the user
        :return: Created user
        """
        assert user.password, "Password is required"
        user_password = user.password.get_decrypted_value()

        if not user_password:
            raise ValueError("Password is required")

        if len(user_password) < 8:
            raise ValueError("Password must be at least 8 characters long")

        salt, password = hash_new_password(user_password)

        user.password = EncryptedSecretStr(f"{salt}${password}")

        body = model_db_dump(user)
        body["provider"] = "ik_service_account"
        new_user = await self.crud.create(body)
        result = await self.crud.get_by_id(new_user.id)

        if self.audit_log_handler:
            await self.audit_log_handler.create_log(new_user.id, requester.id, ModelActions.CREATE)
        return UserResponse.model_validate(result)

    async def update(self, user_id: str, user: UserUpdate, requester: UserDTO) -> UserResponse:
        """
        Update an existing user.
        :param user_id: ID of the user to update
        :param user: User to update
        :param requester: User who updates the user
        :return: Updated user
        """
        body = user.model_dump(exclude_unset=True)
        existing_user = await self.crud.get_by_id(user_id)

        if not existing_user:
            raise EntityNotFound("User not found")

        updated_user = await self.crud.update(existing_user, body)

        if self.audit_log_handler:
            await self.audit_log_handler.create_log(updated_user.id, requester.id, ModelActions.UPDATE)
        return UserResponse.model_validate(updated_user)

    async def get_actions(self, user_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the user.
        :param user_id: ID of the user
        :return: List of actions
        """
        if await user_is_super_admin(requester) is False:
            return []

        actions: list[str] = []
        user = await self.crud.get_by_id(user_id)
        if not user:
            raise EntityNotFound("User not found")
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DELETE)

        return actions

    async def link_accounts(
        self, primary_user_id: str | UUID, secondary_user_id: str | UUID, requester: UserDTO
    ) -> UserResponse:
        """
        Link two user accounts together.
        :param primary_user_id: ID of the primary user
        :param secondary_user_id: ID of the secondary user
        :param requester: User who performs the linking
        :return: Updated primary user with linked secondary account
        """
        primary_user = await self.crud.get_by_id(primary_user_id)
        secondary_user = await self.crud.get_by_id(secondary_user_id)

        if not primary_user or not secondary_user:
            raise EntityNotFound("User not found")

        if primary_user.id == secondary_user.id:
            raise ValueError("Cannot link a user to themselves")

        if primary_user.provider == "ik_service_account" or secondary_user.provider == "ik_service_account":
            raise ValueError("Cannot link 'ik_service_account' users")

        if primary_user.deactivated or secondary_user.deactivated:
            raise ValueError("Cannot link deactivated accounts")

        if secondary_user.is_primary:
            raise ValueError("Cannot link a primary user as a secondary account")

        if secondary_user.primary_account:
            raise ValueError("Secondary user already has a primary account")

        if primary_user.primary_account:
            raise ValueError("Secondary user cannot be linked as primary")

        # Link accounts
        primary_user_dto = UserDTO.model_validate(primary_user)
        if secondary_user_id in [acc.id for acc in primary_user_dto.secondary_accounts]:
            raise ValueError("Accounts are already linked")

        body = {
            "secondary_accounts": [acc.id for acc in primary_user.secondary_accounts] + [secondary_user_id],
            "is_primary": True,
        }
        await self.crud.update(primary_user, body)
        await self.crud.refresh(primary_user)

        if self.audit_log_handler:
            await self.audit_log_handler.create_log(primary_user.id, requester.id, "link_accounts")

        return UserResponse.model_validate(primary_user)

    async def unlink_accounts(
        self, primary_user_id: str | UUID, secondary_user_id: str | UUID, requester: UserDTO
    ) -> UserResponse:
        """
        Unlink two user accounts.
        :param primary_user_id: ID of the primary user
        :param secondary_user_id: ID of the secondary user
        :param requester: User who performs the unlinking
        :return: Updated primary user with unlinked secondary account
        """
        primary_user = await self.crud.get_by_id(primary_user_id)
        secondary_user = await self.crud.get_by_id(secondary_user_id)

        if not primary_user or not secondary_user:
            raise EntityNotFound("User not found")

        if primary_user.id == secondary_user.id:
            raise ValueError("Cannot unlink a user from themselves")

        if primary_user.is_primary is False:
            raise ValueError("Primary user must be a primary account")

        if any(str(acc.id) == str(secondary_user_id) for acc in primary_user.secondary_accounts) is False:
            raise ValueError("Secondary user is not linked to the primary user")

        # Unlink accounts
        body_secondary = {
            "primary_account": [],
            "is_primary": False,
        }

        secondary_accounts = [acc.id for acc in primary_user.secondary_accounts if acc.id != secondary_user_id]
        body_primary = {
            "secondary_accounts": secondary_accounts,
            "is_primary": True,
        }

        if len(secondary_accounts) == 0:
            body_primary["is_primary"] = False

        await self.crud.update(primary_user, body_primary)
        await self.crud.update(secondary_user, body_secondary)

        await self.crud.refresh(secondary_user)
        await self.crud.refresh(primary_user)

        if self.audit_log_handler:
            await self.audit_log_handler.create_log(primary_user.id, requester.id, "unlink_accounts")
            await self.audit_log_handler.create_log(secondary_user.id, requester.id, "unlink_accounts")

        return UserResponse.model_validate(primary_user)
