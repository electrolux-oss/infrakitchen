from datetime import UTC, datetime
import logging
import secrets
import uuid
from uuid import UUID

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_async_session
from core.models.encrypted_secret import EncryptedSecretStr
from core.request_context import get_current_user_agent
from core.users.functions import user_apis_permissions
from core.utils.password_manager import hash_new_password, is_correct_password
from core.users.model import UserDTO

from .crud import PersonalAccessTokenCRUD
from .model import PersonalAccessToken, PersonalAccessTokenDTO
from .schema import (
    PersonalAccessTokenCreate,
    PersonalAccessTokenCreateResponse,
    PersonalAccessTokenResponse,
)

logger = logging.getLogger(__name__)


async def _audit_token_authentication(
    token_id: str | UUID,
    user_id: str | UUID,
    reason: str | None = None,
    token_prefix: str | None = None,
    token_name: str | None = None,
) -> None:
    """Record a personal access token authentication attempt in the audit log.

    The action is always ``login``; success vs failure is carried in the
    ``action_metadata``: a failure sets ``reason`` (e.g. "expired", "revoked",
    "invalid_credentials"), a successful login has no ``reason``. The metadata
    always carries the token's ``token_prefix`` and name so the UI can flag
    the entry as token authentication and show the outcome in the Result
    column — the audit row's ``user_id`` is the token's owner, so this is what
    distinguishes an agent authenticating with a PAT from the owner logging
    in directly.
    Entries are written against the token entity (``entity_id`` = token id,
    ``user_id`` = token owner) via a short-lived, immediately committed
    session so they survive even when the originating request ends in an error
    and its own session is rolled back. Failures to audit are downgraded to a
    warning log: auditing must never block authentication.
    """
    metadata: dict[str, str] = {}
    if reason is not None:
        metadata["reason"] = reason
    if token_prefix is not None:
        metadata["token_prefix"] = token_prefix
    if token_name is not None:
        metadata["token_name"] = token_name
    user_agent = get_current_user_agent()
    if user_agent is not None:
        metadata["user_agent"] = user_agent
    try:
        async with get_async_session() as session:
            await AuditLogHandler(session, entity_name="personal_access_token").create_log(
                token_id,
                user_id,
                "login",
                action_metadata=metadata or None,
            )
            await session.commit()
    except Exception:
        logger.warning("Failed to audit personal access token authentication", exc_info=True)


class PersonalAccessTokenService:
    def __init__(self, crud: PersonalAccessTokenCRUD):
        self.crud = crud

    async def list_tokens(self, user_id: str | UUID) -> list[PersonalAccessToken]:
        tokens = await self.crud.get_all(filter={"user_id": user_id}, sort=("created_at", "desc"))
        return tokens

    async def create_token(
        self, user_id: str | UUID, body: PersonalAccessTokenCreate, requester: UserDTO
    ) -> PersonalAccessTokenCreateResponse:
        # "Agent cannot out-privilege its delegator": granted scopes must be a
        # subset of the owner's own effective API permissions — for both token
        # types, since developer tokens may carry scopes too.
        # user_apis_permissions returns keys like "api:<entity>" (and "*" for
        # super admins), so look up with the same prefix convention.
        if body.scopes is not None:
            owner_permissions = await user_apis_permissions(requester)
            for scope in body.scopes:
                action, _, entity = scope.partition(":")
                owner_action = owner_permissions.get(f"api:{entity}", "")
                if "admin" in owner_action or owner_permissions.get("*") == "admin":
                    continue
                if owner_action != action:
                    raise ValueError(f"Scope {scope!r} exceeds the creator's own permissions")

        token_id = uuid.uuid4()
        token_secret = secrets.token_urlsafe(32)
        raw_token = f"ik_{token_id.hex}_{token_secret}"
        salt, hashed_token = hash_new_password(raw_token)

        created = await self.crud.create(
            {
                "id": token_id,
                "user_id": user_id,
                "name": body.name,
                "scopes": body.scopes,
                "token_hash": EncryptedSecretStr(f"{salt}${hashed_token}").get_secret_value(),
                "token_prefix": f"ik_{token_id.hex[:8]}",
                "expires_at": body.expires_at,
            }
        )
        await self.crud.refresh(created)

        return PersonalAccessTokenCreateResponse(
            token=raw_token,
            **PersonalAccessTokenResponse.model_validate(created).model_dump(),
        )

    async def delete_token(self, token_id: str | UUID, user_id: str | UUID) -> None:
        token = await self.crud.get_by_id(token_id)
        if token is None or str(token.user_id) != str(user_id):
            raise ValueError("Personal access token not found")

        await self.crud.delete(token)

    async def get_valid_token(self, raw_token: str) -> PersonalAccessTokenDTO | None:
        token_id = get_token_lookup_id(raw_token)
        if token_id is None:
            return None

        token = await self.crud.get_by_id(token_id)
        if token is None:
            # Unknown token id: the attempt cannot be attributed to a user, so
            # there is nothing meaningful to audit.
            return None

        if token.revoked_at is not None:
            await _audit_token_authentication(
                token.id,
                token.user_id,
                reason="revoked",
                token_prefix=token.token_prefix,
                token_name=token.name,
            )
            return None

        if token.expires_at is not None and token.expires_at <= datetime.now(UTC):
            await _audit_token_authentication(
                token.id,
                token.user_id,
                reason="expired",
                token_prefix=token.token_prefix,
                token_name=token.name,
            )
            return None

        salt, hashed_token = EncryptedSecretStr(token.token_hash).get_decrypted_value().split("$", maxsplit=1)
        if not is_correct_password(salt, hashed_token, raw_token):
            await _audit_token_authentication(
                token.id,
                token.user_id,
                reason="invalid_credentials",
                token_prefix=token.token_prefix,
                token_name=token.name,
            )
            return None

        await self.crud.update(token, {"last_used_at": datetime.now(UTC)})
        await _audit_token_authentication(
            token.id,
            token.user_id,
            token_prefix=token.token_prefix,
            token_name=token.name,
        )
        return PersonalAccessTokenDTO.model_validate(token)


def get_token_lookup_id(raw_token: str) -> UUID | None:
    if not raw_token.startswith("ik_"):
        return None

    parts = raw_token.split("_", maxsplit=2)
    if len(parts) != 3:
        return None

    _, token_id_hex, _ = parts
    if len(token_id_hex) != 32:
        return None

    try:
        return UUID(hex=token_id_hex)
    except ValueError:
        return None
