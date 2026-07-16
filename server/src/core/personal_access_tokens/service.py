from datetime import UTC, datetime
import secrets
import uuid
from uuid import UUID

from core.models.encrypted_secret import EncryptedSecretStr
from core.utils.password_manager import hash_new_password, is_correct_password

from .crud import PersonalAccessTokenCRUD
from .model import PersonalAccessToken, PersonalAccessTokenDTO
from .schema import (
    PersonalAccessTokenCreate,
    PersonalAccessTokenCreateResponse,
    PersonalAccessTokenResponse,
)


class PersonalAccessTokenService:
    def __init__(self, crud: PersonalAccessTokenCRUD):
        self.crud = crud

    async def list_tokens(self, user_id: str | UUID) -> list[PersonalAccessToken]:
        tokens = await self.crud.get_all(filter={"user_id": user_id}, sort=("created_at", "desc"))
        return tokens

    async def create_token(
        self, user_id: str | UUID, body: PersonalAccessTokenCreate
    ) -> PersonalAccessTokenCreateResponse:
        token_id = uuid.uuid4()
        token_secret = secrets.token_urlsafe(32)
        raw_token = f"ik_{token_id.hex}_{token_secret}"
        salt, hashed_token = hash_new_password(raw_token)

        created = await self.crud.create(
            {
                "id": token_id,
                "user_id": user_id,
                "name": body.name,
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
        if token is None or token.revoked_at is not None:
            return None

        if token.expires_at is not None and token.expires_at <= datetime.now(UTC):
            return None

        salt, hashed_token = EncryptedSecretStr(token.token_hash).get_decrypted_value().split("$", maxsplit=1)
        if not is_correct_password(salt, hashed_token, raw_token):
            return None

        await self.crud.update(token, {"last_used_at": datetime.now(UTC)})
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
