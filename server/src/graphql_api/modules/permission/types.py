import uuid

from strawberry.scalars import JSON
import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.permissions.model import Permission
from graphql_api.modules.user.converters import get_user_type_loader
from graphql_api.modules.user.types import UserType


permission_mapper = StrawberrySQLAlchemyMapper()


@permission_mapper.type(Permission)
class PermissionType:
    __exclude__ = ["created_by"]

    id: uuid.UUID = strawberry.UNSET
    v0: str | None = None
    v1: str | None = None
    creator: UserType | None = None

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        entity = self.v1.split(":")[0] if self.v1 else None
        entity_id = self.v1.split(":")[1] if self.v1 and ":" in self.v1 else None
        if entity == "api":
            return None

        if entity_id == "*":
            return None

        loader = info.context["loaders"].get(entity)
        if loader is None:
            return None
        return await loader.load(entity_id)

    @strawberry.field
    async def user_data(self, info: Info) -> UserType | None:
        if not self.v0 or not self.v0.startswith("user:"):
            return None
        user_id = self.v0.split(":")[1]
        loader = get_user_type_loader(info, "userData")
        return await loader.load(user_id)


@strawberry.type
class RoleType:
    id: uuid.UUID = strawberry.UNSET
    v1: str | None = None


permission_mapper.finalize()
