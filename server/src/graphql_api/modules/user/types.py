import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.users.model import User


user_mapper = StrawberrySQLAlchemyMapper()


@strawberry.type
class UserShortType:
    id: uuid.UUID
    identifier: str | None = None
    provider: str | None = None


@user_mapper.type(User)
class UserType:
    __exclude__ = ["password", "secondary_accounts", "primary_account"]

    secondary_accounts: list[UserShortType] = strawberry.field(default_factory=list)
    primary_account: list[UserShortType] = strawberry.field(default_factory=list)


user_mapper.finalize()
