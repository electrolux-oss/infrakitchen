import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.use_cases.create_integration_with_storage.dependencies import (
    get_integration_with_storage_service,
)
from application.use_cases.create_integration_with_storage.schema import IntegrationCreateWithStorage
from application.use_cases.create_template_with_scv.dependencies import get_template_with_scv_service
from application.use_cases.create_template_with_scv.schema import TemplateCreateWithSCV
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.template.types import TemplateType


@strawberry_pydantic.input(model=IntegrationCreateWithStorage, all_fields=False)
class IntegrationCreateWithStorageInput:
    name: str = strawberry.UNSET
    description: str = ""
    integration_type: str = strawberry.UNSET
    integration_provider: str = strawberry.UNSET
    labels: list[str] = strawberry.field(default_factory=list)
    configuration: JSON = strawberry.UNSET
    create_storage: bool = True


@strawberry_pydantic.input(model=TemplateCreateWithSCV, all_fields=False)
class TemplateCreateWithScvInput:
    name: str = strawberry.UNSET
    description: str = ""
    source_code_branch: str = "main"
    source_code_url: str = strawberry.UNSET
    source_code_folder: str = "/"
    integration_id: str | None = None
    source_code_language: str = "Terraform"
    labels: list[str] = strawberry.field(default_factory=list)
    parents: list[uuid.UUID] = strawberry.field(default_factory=list)


@strawberry.type
class UseCaseMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_integration_with_storage(
        self, info: Info, input: IntegrationCreateWithStorageInput
    ) -> IntegrationType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_integration_with_storage_service(session=session)
        return await service.create(integration_with_storage=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_template_with_scv(self, info: Info, input: TemplateCreateWithScvInput) -> TemplateType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_template_with_scv_service(session=session)
        return await service.create(template_with_scv=input.to_pydantic(), requester=requester)
