import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.worker_templates.dependencies import get_worker_template_service
from application.worker_templates.schema import WorkerTemplateCreate, WorkerTemplateUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.worker_template.types import WorkerTemplateType, WorkerTemplateValidationType


@strawberry_pydantic.input(model=WorkerTemplateCreate, all_fields=False)
class WorkerTemplateCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    provider: str = strawberry.UNSET
    configuration: JSON = strawberry.UNSET
    max_workers: int = 3
    idle_timeout_seconds: int = 300
    priority: int = 0
    labels: list[str] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=WorkerTemplateUpdate, all_fields=False)
class WorkerTemplateUpdateInput:
    description: str | None = strawberry.UNSET
    labels: list[str] | None = strawberry.UNSET
    configuration: JSON | None = strawberry.UNSET
    max_workers: int | None = strawberry.UNSET
    idle_timeout_seconds: int | None = strawberry.UNSET
    priority: int | None = strawberry.UNSET


@strawberry.input
class WorkerTemplateActionInput:
    action: str


@strawberry.type
class WorkerTemplateMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_worker_template(self, info: Info, input: WorkerTemplateCreateInput) -> WorkerTemplateType:
        await check_api_permission(info, "worker_template", ["admin"])
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_worker_template_service(session)
        return await service.create_worker_template(worker_template=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_worker_template(
        self, info: Info, id: uuid.UUID, input: WorkerTemplateUpdateInput
    ) -> WorkerTemplateType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_worker_template_service(session)

        if ModelActions.EDIT not in await service.get_actions(worker_template_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_worker_template(
            worker_template_id=str(id), worker_template=input.to_pydantic(), requester=requester
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def worker_template_action(
        self, info: Info, id: uuid.UUID, input: WorkerTemplateActionInput
    ) -> WorkerTemplateType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_worker_template_service(session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(worker_template_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action_worker_template(
            worker_template_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_worker_template(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_worker_template_service(session)

        if ModelActions.DELETE not in await service.get_actions(worker_template_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(worker_template_id=str(id), requester=requester)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def validate_worker_template(self, info: Info, id: uuid.UUID) -> WorkerTemplateValidationType:
        await check_api_permission(info, "worker_template", ["admin"])
        session = info.context["session"]
        service = get_worker_template_service(session)
        try:
            await service.validate(id)
        except Exception as e:
            return WorkerTemplateValidationType(is_valid=False, message=str(e))
        return WorkerTemplateValidationType(is_valid=True, message="Worker template is valid")

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def validate_worker_template_draft(
        self, info: Info, input: WorkerTemplateCreateInput
    ) -> WorkerTemplateValidationType:
        await check_api_permission(info, "worker_template", ["admin"])
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_worker_template_service(session)
        try:
            await service.validate_draft(input.to_pydantic(), requester)
        except Exception as e:
            return WorkerTemplateValidationType(is_valid=False, message=str(e))
        return WorkerTemplateValidationType(is_valid=True, message="Worker template is valid")
