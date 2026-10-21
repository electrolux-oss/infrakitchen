from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper
from strawberry.scalars import JSON
from strawberry.types import Info
from typing import cast
import strawberry

from core.audit_logs.model import AuditLog
from graphql_api.modules.user.types import UserType
from graphql_api.dataloaders.entity_loaders import has_entity_loader, load_entity_data


audit_log_mapper = StrawberrySQLAlchemyMapper()


@audit_log_mapper.type(AuditLog)
class AuditLogType:
    __exclude__ = ["action_metadata"]

    creator: UserType | None = None
    model: str = ""
    entity_id: str = ""

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        return await load_entity_data(info, self.model, str(self.entity_id))

    @strawberry.field
    def entity_loader_missing(self, info: Info) -> bool:
        return not has_entity_loader(info, self.model)

    @strawberry.field(name="metadata")
    def resolve_metadata(self) -> JSON | None:
        return cast(JSON | None, getattr(self, "action_metadata", None))


audit_log_mapper.finalize()
