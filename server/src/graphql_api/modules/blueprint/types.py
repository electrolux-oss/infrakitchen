import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.blueprints.model import Blueprint

from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType
from graphql_api.modules.workflow.types import WorkflowType


blueprint_mapper = StrawberrySQLAlchemyMapper()


@blueprint_mapper.type(Blueprint)
class BlueprintType:
    __exclude__ = ["templates", "external_templates", "workflows", "created_by"]

    templates: list[TemplateType] | None = None
    external_templates: list[TemplateType] | None = None
    workflows: list[WorkflowType] | None = None
    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "blueprint"


blueprint_mapper.finalize()
