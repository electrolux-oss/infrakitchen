import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.users.model import User


user_mapper = StrawberrySQLAlchemyMapper()


@strawberry.type
class UserMetadataType:
    slack_id: str | None = None


@strawberry.type
class UserShortType:
    id: uuid.UUID
    identifier: str | None = None
    provider: str | None = None


@user_mapper.type(User)
class UserType:
    __exclude__ = ["password", "secondary_accounts", "primary_account", "meta"]

    secondary_accounts: list[UserShortType] = strawberry.field(default_factory=list)
    primary_account: list[UserShortType] = strawberry.field(default_factory=list)

    @strawberry.field
    def meta(self) -> UserMetadataType | None:
        # self is the SQLAlchemy User instance; meta is a JSON column returned as dict
        raw = self.__dict__.get("meta")
        if not isinstance(raw, dict):
            return None
        return UserMetadataType(slack_id=raw.get("slack_id"))


user_mapper.finalize()
