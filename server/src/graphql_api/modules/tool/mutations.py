import uuid

import strawberry
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from core.tools.dependencies import get_tool_service
from core.tools.schema import ToolDownloadRequest
from core.errors import AccessDenied
from graphql_api.helpers import IsSuperAdmin
from graphql_api.modules.tool.types import ToolType


@strawberry_pydantic.input(model=ToolDownloadRequest, all_fields=False)
class ToolDownloadInput:
    name: str = strawberry.UNSET
    version: str = strawberry.UNSET
    os: str = "linux"
    arch: str | None = None


@strawberry.input
class ToolActionInput:
    action: str


@strawberry.type
class ToolMutation:
    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def download_tool(self, info: Info, input: ToolDownloadInput) -> ToolType:
        requester = info.context["request"].state.user
        service = get_tool_service(session=info.context["session"])
        return await service.request_download(request=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def set_default_tool(self, info: Info, id: uuid.UUID | None = None) -> ToolType | None:
        """Set the global default tool, no id clears it and the runtime tofu is used."""
        requester = info.context["request"].state.user
        service = get_tool_service(session=info.context["session"])
        return await service.set_default(id, requester=requester)

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def tool_action(self, info: Info, id: uuid.UUID, input: ToolActionInput) -> ToolType:
        requester = info.context["request"].state.user
        service = get_tool_service(session=info.context["session"])
        if input.action not in await service.get_actions(tool_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")
        return await service.patch_action(id, action=input.action, requester=requester)

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def delete_tool(self, info: Info, id: uuid.UUID) -> bool:
        requester = info.context["request"].state.user
        service = get_tool_service(session=info.context["session"])
        await service.delete(id, requester=requester)
        return True
