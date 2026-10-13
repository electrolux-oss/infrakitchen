import datetime
import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.personal_access_tokens.model import PersonalAccessToken


@strawberry.type
class RefreshAuthTokenType:
    token: str
    expiration: str
    provider: str


@strawberry.type
class LogoutResponseType:
    success: bool


@strawberry.type
class ServiceAccountTokenType:
    token: str
    expires_at: str


pt_mapper = StrawberrySQLAlchemyMapper()


def _token_type_of(token: "PersonalAccessToken") -> str:
    """Presentation type of a stored token.

    The server stores no separate type column: a token carrying scopes is
    presented as an agent token, everything else as a developer token.
    """
    return "agent" if token.scopes else "developer"


def _extra_token_fields(cls: type) -> None:
    """Apply the shared extra field to a mapper-generated type class."""
    cls.token_type = strawberry.field(resolver=_token_type_of)


@pt_mapper.type(PersonalAccessToken)
class PersonalAccessTokenType:
    __exclude__ = ["user_id", "user", "token_hash"]

    id: uuid.UUID = strawberry.UNSET
    scopes: list[str] | None = None


_extra_token_fields(PersonalAccessTokenType)


@pt_mapper.type(PersonalAccessToken)
class PersonalAccessTokenCreateType:
    __exclude__ = ["user_id", "user", "token_hash"]

    id: uuid.UUID = strawberry.UNSET
    scopes: list[str] | None = None
    expires_at: datetime.datetime | None = None
    last_used_at: datetime.datetime | None = None
    revoked_at: datetime.datetime | None = None
    token: str = strawberry.UNSET


_extra_token_fields(PersonalAccessTokenCreateType)


pt_mapper.finalize()
