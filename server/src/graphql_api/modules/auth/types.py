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


@pt_mapper.type(PersonalAccessToken)
class PersonalAccessTokenType:
    __exclude__ = ["user_id", "user", "token_hash"]

    id: uuid.UUID = strawberry.UNSET


@pt_mapper.type(PersonalAccessToken)
class PersonalAccessTokenCreateType:
    __exclude__ = ["user_id", "user", "token_hash"]

    id: uuid.UUID = strawberry.UNSET
    expires_at: datetime.datetime | None = None
    last_used_at: datetime.datetime | None = None
    revoked_at: datetime.datetime | None = None
    token: str = strawberry.UNSET


pt_mapper.finalize()
