from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper
from strawberry.scalars import JSON
from strawberry.types import Info
import strawberry

from core.audit_logs.model import AuditLog
from graphql_api.modules.user.types import UserType


audit_log_mapper = StrawberrySQLAlchemyMapper()


@audit_log_mapper.type(AuditLog)
class AuditLogType:
    creator: UserType | None = None
    model: str = ""
    entity_id: str = ""

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        loader = info.context["loaders"].get(self.model)
        if loader is None:
            return None
        return await loader.load(str(self.entity_id))


audit_log_mapper.finalize()
