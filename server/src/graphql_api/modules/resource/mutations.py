import uuid
from typing import Any, cast

import strawberry
from strawberry import Maybe
from strawberry.scalars import JSON
from strawberry.types import Info

from application.resources.dependencies import get_cascade_destroy_service, get_resource_service
from application.resources.schema import ResourceCreate, ResourceUpdate
from application.workflows.model import Workflow
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from core.users.functions import user_has_access_to_entity, user_is_super_admin
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.notification.types import SubscriptionType
from graphql_api.modules.permission.mutations import EntityPolicyCreateInput
from graphql_api.modules.permission.types import PermissionType
from graphql_api.modules.resource.types import ResourceType
from graphql_api.modules.workflow.types import WorkflowType
from strawberry.experimental import pydantic as strawberry_pydantic


@strawberry_pydantic.input(model=ResourceCreate, all_fields=True)
class ResourceCreateInput:
    name: str = strawberry.UNSET
    template_id: uuid.UUID = strawberry.UNSET
    description: str = ""
    source_code_version_id: uuid.UUID | None = None
    integration_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    secret_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    storage_id: uuid.UUID | None = None
    storage_path: str | None = None
    variables: JSON | None = None
    dependency_tags: JSON | None = None
    dependency_config: JSON | None = None
    parents: list[uuid.UUID] = strawberry.field(default_factory=list)
    children: list[uuid.UUID] = strawberry.field(default_factory=list)
    labels: list[str] = strawberry.field(default_factory=list)
    workspace_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None


@strawberry.input
class ResourceUpdateInput:
    name: Maybe[str | None] = None
    description: Maybe[str | None] = None
    source_code_version_id: Maybe[uuid.UUID | None] = None
    integration_ids: Maybe[list[uuid.UUID] | None] = None
    secret_ids: Maybe[list[uuid.UUID] | None] = None
    storage_id: Maybe[uuid.UUID | None] = None
    storage_path: Maybe[str | None] = None
    variables: Maybe[JSON | None] = None
    dependency_tags: Maybe[JSON | None] = None
    dependency_config: Maybe[JSON | None] = None
    labels: Maybe[list[str] | None] = None
    workspace_id: Maybe[uuid.UUID | None] = None
    project_id: Maybe[uuid.UUID | None] = None

    def to_pydantic(self) -> ResourceUpdate:
        data: dict[str, Any] = {}
        for field_name, value in vars(self).items():
            if value is not None:
                data[field_name] = value.value

        return ResourceUpdate(**data)


@strawberry.input
class ResourceActionInput:
    action: str


@strawberry.input
class ResourceSubscriptionCreateInput:
    resource_id: str
    inherit_children: bool = False
    user_id: str | None = None


@strawberry.input
class ResourceSubscriptionDeleteInput:
    resource_id: str
    inherit_children: bool = False
    user_id: str | None = None


@strawberry.input
class ResourcePolicyCreateInput:
    role: str | None = None
    user_id: uuid.UUID | None = None
    entity_id: uuid.UUID
    action: str
    inherits_children: bool = False


@strawberry.type
class ResourceMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_resource(self, info: Info, input: ResourceCreateInput) -> ResourceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_resource_service(session)
        return await service.create_resource(resource=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_resource(self, info: Info, id: uuid.UUID, input: ResourceUpdateInput) -> ResourceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_resource_service(session)

        if ModelActions.EDIT not in await service.get_actions(resource_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_resource(resource_id=str(id), resource=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def sync_workspace(self, info: Info, id: uuid.UUID) -> ResourceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_resource_service(session)

        if ModelActions.EDIT not in await service.get_actions(resource_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.sync_workspace(resource_id=str(id), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def resource_action(self, info: Info, id: uuid.UUID, input: ResourceActionInput) -> ResourceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_resource_service(session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(resource_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action_resource(
            resource_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_resource(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_resource_service(session)

        if ModelActions.DELETE not in await service.get_actions(resource_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(resource_id=str(id), requester=requester)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def cascade_destroy_resource(self, info: Info, id: uuid.UUID) -> WorkflowType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        resource_service = get_resource_service(session)

        if ModelActions.CASCADE_DESTROY not in await resource_service.get_actions(resource_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.CASCADE_DESTROY.value}")

        cascade_destroy_service = get_cascade_destroy_service(session=session)
        workflow = await cascade_destroy_service.create_cascade_destroy_workflow(
            resource_id=id,
            requester=requester,
        )

        workflow_orm = await session.get(Workflow, workflow.id)
        if workflow_orm is None:
            raise ValueError("Cascade destroy workflow was not persisted")

        return workflow_orm

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_resource_policy(self, info: Info, input: EntityPolicyCreateInput) -> list[PermissionType]:
        session = info.context["session"]
        requester = info.context["request"].state.user

        if not await user_has_access_to_entity(requester, input.entity_id, "admin", "resource"):  # pyright: ignore
            raise AccessDenied("Access denied: admin access to resource required")

        service = get_resource_service(session)
        return await service.create_resource_policy(
            resource_policy=input.to_pydantic(),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_resource_subscription(
        self,
        info: Info,
        input: ResourceSubscriptionCreateInput,
    ) -> list[SubscriptionType]:
        session = info.context["session"]
        requester = info.context["request"].state.user

        if input.user_id and str(input.user_id) != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can create subscriptions for other users")

        service = get_resource_service(session)

        subscriptions = await service.create_resource_subscription(
            resource_id=input.resource_id,
            requester=requester,
            inherit_children=input.inherit_children,
            user_id=input.user_id,
        )
        return cast(list[SubscriptionType], subscriptions)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_resource_subscription(
        self,
        info: Info,
        input: ResourceSubscriptionDeleteInput,
    ) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user

        user_id = input.user_id

        if user_id and str(user_id) != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can delete subscriptions for other users")

        service = get_resource_service(session)

        return await service.delete_resource_subscription(
            resource_id=input.resource_id,
            requester=requester,
            inherit_children=input.inherit_children,
            user_id=user_id,
        )
