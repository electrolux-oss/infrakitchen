from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper
from strawberry.scalars import JSON
from strawberry.types import Info
from typing import cast
import strawberry

from core.audit_logs.model import AuditLog
from graphql_api.modules.user.types import UserType


audit_log_mapper = StrawberrySQLAlchemyMapper()


@audit_log_mapper.type(AuditLog)
class AuditLogType:
    __exclude__ = ["action_metadata"]

    creator: UserType | None = None
    model: str = ""
    entity_id: str = ""

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        loader = info.context["loaders"].get(self.model)
        if loader is None:
            return None
        return await loader.load(str(self.entity_id))

    @strawberry.field(name="metadata")
    def resolve_metadata(self) -> JSON | None:
        return cast(JSON | None, getattr(self, "action_metadata", None))


audit_log_mapper.finalize()
