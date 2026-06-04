import uuid

import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.templates.model import Template

from graphql_api.modules.user.types import UserType


template_mapper = StrawberrySQLAlchemyMapper()


@strawberry.type
class TemplateShortType:
    id: uuid.UUID
    name: str
    abstract: bool
    cloud_resource_types: list[str]


@template_mapper.type(Template)
class TemplateType:
    __exclude__ = ["children", "parents", "created_by"]

    id: uuid.UUID = strawberry.UNSET
    children: list[TemplateShortType] | None = None
    parents: list[TemplateShortType] | None = None
    creator: UserType | None = None

    @strawberry.field
    async def resources_count(self, info: Info) -> int:
        return await info.context["loaders"]["template_resource_count"].load(str(self.id))

    @strawberry.field
    async def source_code_versions_count(self, info: Info) -> int:
        return await info.context["loaders"]["template_source_code_version_count"].load(str(self.id))


template_mapper.finalize()
