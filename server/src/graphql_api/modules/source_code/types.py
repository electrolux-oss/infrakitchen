import uuid
from sqlalchemy import func, select
import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.source_code_versions.model import SourceCodeVersion
from application.source_codes.model import SourceCode
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserType


source_code_mapper = StrawberrySQLAlchemyMapper()


@source_code_mapper.type(SourceCode)
class SourceCodeType:
    __exclude__ = ["created_by", "integration"]
    id: uuid.UUID = strawberry.UNSET
    source_code_url: str | None = None
    integration: IntegrationType | None = None

    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "source_code"

    @strawberry.field
    def identifier(self) -> str:
        return f"{self.source_code_url}"

    @strawberry.field
    async def source_code_version_count(self, info: Info) -> int:
        session = info.context["session"]
        stmt = select(func.count()).select_from(SourceCodeVersion).where(SourceCodeVersion.source_code_id == self.id)
        result = await session.execute(stmt)
        return result.scalar_one()


source_code_mapper.finalize()
