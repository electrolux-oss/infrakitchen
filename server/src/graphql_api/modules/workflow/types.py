import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.workflows.model import Workflow, WorkflowStep

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.resource.types import ResourceType
from graphql_api.modules.secret.types import SecretType
from graphql_api.modules.source_code_version.types import SourceCodeVersionType
from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType


workflow_mapper = StrawberrySQLAlchemyMapper()


@workflow_mapper.type(WorkflowStep)
class WorkflowStepType:
    __exclude__ = [
        "parent_resource_ids",
        "integration_ids",
        "secret_ids",
        "template_id",
        "source_code_version_id",
        "workflow_id",
        "resource",
        "resource_id",
        "template",
        "source_code_version",
        "workflow",
    ]

    parent_resource_ids: list[ResourceType] | None = None
    integration_ids: list[IntegrationType] | None = None
    secret_ids: list[SecretType] | None = None
    workflow: "WorkflowType | None" = None
    template: TemplateType | None = None
    source_code_version: SourceCodeVersionType | None = None
    resource: ResourceType | None = None


@workflow_mapper.type(Workflow)
class WorkflowType:
    __exclude__ = ["steps", "created_by"]

    creator: UserType | None = None

    steps: list[WorkflowStepType] | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "workflow"


workflow_mapper.finalize()
