import logging
from typing import Any
from uuid import UUID

from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions, ModelStatus
from core.database import FieldSpec
from core.errors import DependencyError, EntityExistsError, EntityNotFound, EntityWrongState
from core.users.functions import user_is_super_admin
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import ToolCRUD
from .functions import host_arch
from .model import Tool
from .release_sources import get_release_source, list_versions
from .schema import ToolDownloadRequest, ToolResponse

logger = logging.getLogger(__name__)


class ToolService:
    """
    ToolService manages executables (e.g. OpenTofu/Terraform releases) stored in the database.
    Downloads are performed by the task worker, see ToolTask.
    """

    def __init__(self, crud: ToolCRUD, event_sender: EventSender, audit_log_handler: AuditLogHandler):
        self.crud: ToolCRUD = crud
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, tool_id: str | UUID) -> ToolResponse | None:
        tool = await self.crud.get_by_id(tool_id)
        return ToolResponse.model_validate(tool) if tool else None

    async def get_all(self, **kwargs) -> list[ToolResponse]:
        return [ToolResponse.model_validate(tool) for tool in await self.crud.get_all(**kwargs)]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, tool_id: str | UUID, fields: FieldSpec | None = None) -> Tool | None:
        return await self.crud.get_by_id(tool_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Tool]:
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def list_available_versions(self, name: str, include_prerelease: bool = False) -> list[str]:
        _ = get_release_source(name)
        return await list_versions(name, include_prerelease=include_prerelease)

    async def validate_ready(self, tool_id: str | UUID) -> ToolResponse:
        """Ensure the tool exists and has been downloaded, so it can be assigned to an entity."""
        tool = await self.get_by_id(tool_id)
        if tool is None:
            raise EntityNotFound("Tool not found")
        if tool.status != ModelStatus.DONE:
            raise EntityWrongState(f"Tool {tool.name} {tool.version} is not downloaded, status: {tool.status}")
        return tool

    async def get_actions(self, tool_id: str | UUID, requester: UserDTO) -> list[str]:
        """Actions available for the tool, only super admins can manage tools."""
        tool = await self.crud.get_by_id(tool_id)
        if tool is None:
            raise EntityNotFound("Tool not found")
        if not await user_is_super_admin(requester):
            return []

        if tool.is_default:
            return ["clear_default"]

        actions: list[str] = []
        match tool.status:
            case ModelStatus.DONE:
                actions.extend(["set_default", ModelActions.DISABLE])
            case ModelStatus.ERROR:
                actions.extend([ModelActions.DOWNLOAD, ModelActions.DISABLE])
            case ModelStatus.DISABLED:
                actions.extend([ModelActions.ENABLE, ModelActions.DELETE])
            case _:
                pass
        return actions

    async def patch_action(self, tool_id: str | UUID, action: str, requester: UserDTO) -> Tool:
        """
        Disable or enable the tool. A disabled tool can't be selected by entities
        or set as the default, entities already using it keep working.
        """
        tool = await self.crud.get_by_id(tool_id)
        if tool is None:
            raise EntityNotFound("Tool not found")

        match action:
            case ModelActions.DISABLE:
                if tool.is_default:
                    raise EntityWrongState("Tool is the global default, select another default or clear it first")
                if tool.status not in [ModelStatus.DONE, ModelStatus.ERROR]:
                    raise EntityWrongState(f"Tool has wrong status for disabling: {tool.status}")
                status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if tool.status != ModelStatus.DISABLED:
                    raise EntityWrongState("Tool is already enabled")
                # back to the state before it was disabled
                status = ModelStatus.DONE if tool.sha256 else ModelStatus.ERROR
            case _:
                raise ValueError(f"Action {action} is not supported")

        await self.audit_log_handler.create_log(tool.id, requester.id, action)
        tool = await self.crud.update(tool, {"status": status})
        await self.crud.refresh(tool)
        await self.event_sender.send_event(ToolResponse.model_validate(tool), action)
        return tool

    async def get_default(self) -> ToolResponse | None:
        tool = await self.crud.get_default()
        return ToolResponse.model_validate(tool) if tool else None

    async def set_default(self, tool_id: str | UUID | None, requester: UserDTO) -> Tool | None:
        """
        Make the tool the global default used by entities without a selected tool.
        None clears the default, so the tofu installed in the worker runtime is used.
        """
        if tool_id is None:
            previous = await self.crud.get_default()
            await self.crud.set_default(None)
            if previous is not None:
                await self.audit_log_handler.create_log(previous.id, requester.id, ModelActions.UPDATE)
                await self.crud.refresh(previous)
                await self.event_sender.send_event(ToolResponse.model_validate(previous), ModelActions.UPDATE)
            return None

        _ = await self.validate_ready(tool_id)
        tool = await self.crud.get_by_id(tool_id)
        if tool is None:
            raise EntityNotFound("Tool not found")
        previous = await self.crud.get_default()
        await self.crud.set_default(tool)
        await self.audit_log_handler.create_log(tool.id, requester.id, ModelActions.UPDATE)
        await self.event_sender.send_event(ToolResponse.model_validate(tool), ModelActions.UPDATE)
        if previous is not None and previous.id != tool.id:
            # the previous default is cleared by a bulk update, notify about it as well
            await self.crud.refresh(previous)
            await self.event_sender.send_event(ToolResponse.model_validate(previous), ModelActions.UPDATE)
        return tool

    async def request_download(self, request: ToolDownloadRequest, requester: UserDTO) -> Tool:
        source = get_release_source(request.name)
        arch = request.arch or host_arch()

        available = await list_versions(request.name, include_prerelease=True)
        if request.version not in available:
            raise ValueError(f"Version {request.version} of {request.name} is not available")

        existing = await self.crud.get_one(name=request.name, version=request.version, os=request.os, arch=arch)
        if existing is not None and existing.status != ModelStatus.ERROR:
            raise EntityExistsError(f"{request.name} {request.version} ({request.os}/{arch}) already exists")

        body: dict[str, Any] = {
            "name": request.name,
            "version": request.version,
            "os": request.os,
            "arch": arch,
            "executable": source.executable,
            "source_url": source.download_url(request.version, request.os, arch),
            "status": ModelStatus.QUEUED,
            "error_message": "",
            "created_by": requester.id,
        }

        if existing is not None:
            # retry of a failed download
            tool = await self.crud.update(existing, body)
            action = ModelActions.RETRY
        else:
            tool = await self.crud.create(body)
            action = ModelActions.CREATE

        tool = await self.crud.get_by_id(tool.id)
        if tool is None:
            raise EntityNotFound("Tool not found after creation")

        await self.audit_log_handler.create_log(tool.id, requester.id, action)
        await self.event_sender.send_task(
            tool.id,
            requester=requester,
            action=ModelActions.EXECUTE,
            trace_id=self.audit_log_handler.trace_id,
            audit_log_id=self.audit_log_handler.audit_log_id,
        )
        await self.event_sender.send_event(ToolResponse.model_validate(tool), ModelActions.CREATE)
        return tool

    async def delete(self, tool_id: str | UUID, requester: UserDTO) -> None:
        tool = await self.crud.get_by_id(tool_id)
        if tool is None:
            raise EntityNotFound("Tool not found")

        if tool.status != ModelStatus.DISABLED:
            raise EntityWrongState(f"Tool must be disabled before deleting, status: {tool.status}")

        dependencies = await self.crud.get_dependencies(tool)
        if dependencies:
            raise DependencyError(
                "Cannot delete a tool that is used by other entities",
                metadata=[
                    {
                        "id": dependency.id,
                        "name": dependency.name,
                        "entityName": dependency.type,
                    }
                    for dependency in dependencies
                ],
            )

        response = ToolResponse.model_validate(tool)
        await self.audit_log_handler.create_log(tool.id, requester.id, ModelActions.DELETE)
        await self.crud.delete(tool)
        await self.event_sender.send_event(response, ModelActions.DELETE)
