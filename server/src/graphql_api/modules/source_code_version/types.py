import uuid
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.source_code_versions.model import (
    SourceCodeVersion,
    SourceConfig,
    SourceConfigTemplateReference,
    SourceOutputConfig,
)
from graphql_api.modules.source_code.types import SourceCodeType
from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType

import strawberry
from datetime import datetime
from strawberry.types import Info

source_code_version_mapper = StrawberrySQLAlchemyMapper()


@source_code_version_mapper.type(SourceConfig)
class SourceConfigType:
    __exclude__ = ["source_code_version"]


@source_code_version_mapper.type(SourceOutputConfig)
class SourceOutputConfigType:
    pass


@source_code_version_mapper.type(SourceConfigTemplateReference)
class SourceConfigTemplateReferenceType:
    pass


@source_code_version_mapper.type(SourceCodeVersion)
class SourceCodeVersionType:
    __exclude__ = ["variable_configs", "output_configs", "created_by", "template_id", "source_code_id"]

    id: uuid.UUID = strawberry.UNSET
    source_code_folder: str | None = None
    source_code_version: str | None = None
    source_code_branch: str | None = None
    template: TemplateType | None = None
    source_code: SourceCodeType | None = None
    variable_configs: list[SourceConfigType] | None = None
    output_configs: list[SourceOutputConfigType] | None = None
    creator: UserType | None = None
    status: str | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "source_code_version"

    @strawberry.field
    def identifier(self) -> str:
        return f"{self.source_code_folder}:{self.source_code_version or self.source_code_branch}"

    @strawberry.field
    async def resources_count(self, info: Info) -> int:
        return await info.context["loaders"]["source_code_version_resource_count"].load(str(self.id))


source_code_version_mapper.finalize()


@strawberry.type
class SourceOutputConfigTemplateType:
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    status: str


@strawberry.type
class TemplatePortsParentType:
    id: uuid.UUID
    name: str
    abstract: bool


@strawberry.type
class TemplatePortsTemplateType:
    id: uuid.UUID
    name: str
    abstract: bool
    parents: list[TemplatePortsParentType]


@strawberry.type
class TemplatePortsConfigType:
    name: str


@strawberry.type
class TemplatePortsOutputType:
    name: str


@strawberry.type
class TemplatePortsReferenceType:
    reference_template_id: uuid.UUID
    template_id: uuid.UUID
    input_config_name: str
    output_config_name: str


@strawberry.type
class TemplatePortsItemType:
    template: TemplatePortsTemplateType
    configs: list[TemplatePortsConfigType]
    outputs: list[TemplatePortsOutputType]
    references: list[TemplatePortsReferenceType]
