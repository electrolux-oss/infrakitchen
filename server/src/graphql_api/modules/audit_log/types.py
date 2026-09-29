from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper
from strawberry.scalars import JSON
from strawberry.types import Info
from typing import Any, cast
import strawberry

from core.audit_logs.model import AuditLog
from graphql_api.modules.user.types import UserType


audit_log_mapper = StrawberrySQLAlchemyMapper()


@audit_log_mapper.type(AuditLog)
class AuditLogType:
    __exclude__ = ["entity_snapshot"]

    creator: UserType | None = None
    model: str = ""
    entity_id: str = ""

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        loader = info.context["loaders"].get(self.model)
        if loader is not None:
            entity_data = await loader.load(str(self.entity_id))
            if entity_data is not None:
                return entity_data

        snapshot: dict[str, Any] | None = getattr(self, "entity_snapshot", None)
        if not snapshot:
            return None
        deleted_entity_data: dict[str, Any] = {**snapshot, "deleted": True}
        return cast(JSON, cast(object, deleted_entity_data))


audit_log_mapper.finalize()
