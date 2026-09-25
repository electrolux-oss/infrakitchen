import logging
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants.model import ModelActions, ModelStatus
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import ToolCRUD
from .model import Tool
from .release_sources import download_release, get_release_source
from .schema import ToolResponse

logger = logging.getLogger(__name__)


class ToolTask:
    """Downloads a tool release and stores it in the database."""

    def __init__(
        self,
        session: AsyncSession,
        crud_tool: ToolCRUD,
        tool_instance: Tool,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
    ) -> None:
        self.session: AsyncSession = session
        self.crud_tool: ToolCRUD = crud_tool
        self.tool_instance: Tool = tool_instance
        self.logger: EntityLogger = logger
        self.user: UserDTO = user
        self.event_sender: EventSender = event_sender
        self.action: ModelActions = action

    async def start_pipeline(self):
        if self.action != ModelActions.EXECUTE:
            raise CannotProceed(f"Unknown action: {self.action}")

        tool = self.tool_instance
        if tool.status == ModelStatus.DONE:
            self.logger.info(f"{tool.name} {tool.version} is already downloaded")
            return

        self.logger.add_log_header(f"User: {self.user.identifier} Action: {self.action}")
        await self.change_status(ModelStatus.IN_PROGRESS)

        source = get_release_source(tool.name)
        self.logger.info(f"Downloading {source.download_url(tool.version, tool.os, tool.arch)}")
        try:
            content, sha256 = await download_release(source, tool.version, tool.os, tool.arch)
        except (httpx.HTTPError, ValueError) as e:
            tool.error_message = str(e)
            raise CannotProceed(f"Failed to download {tool.name} {tool.version}: {e}") from e

        tool.content = content
        tool.sha256 = sha256
        tool.size = len(content)
        tool.error_message = ""
        self.logger.info(f"Downloaded {tool.name} {tool.version}, {len(content)} bytes, sha256 {sha256}")
        await self.change_status(ModelStatus.DONE)

    async def change_status(self, new_status: ModelStatus) -> None:
        self.tool_instance.status = new_status
        await self.logger.save_log()
        await self.session.commit()
        await self.crud_tool.refresh(self.tool_instance)
        await self.event_sender.send_event(ToolResponse.model_validate(self.tool_instance), ModelActions.UPDATE)
        try:
            await self.event_sender.flush()
        except Exception as e:
            # the status is committed already, a lost UI event must not fail the task and overwrite it with ERROR
            logger.warning(f"Failed to publish status event for tool {self.tool_instance.id}: {e}")

    async def make_failed(self) -> None:
        await self.change_status(ModelStatus.ERROR)

    async def make_retry(self, retry: int, max_retries: int):
        self.logger.warning(f"Retrying {retry}/{max_retries}")


async def get_tool_task(
    session: AsyncSession,
    obj_id: UUID,
    user: UserDTO,
    action: ModelActions,
    trace_id: str | None = None,
    audit_log_id: UUID | None = None,
) -> ToolTask:
    crud_tool = ToolCRUD(session=session)
    tool_instance = await crud_tool.get_by_id(obj_id)
    if not tool_instance:
        raise CannotProceed(f"Tool {obj_id} not found")

    return ToolTask(
        session=session,
        crud_tool=crud_tool,
        tool_instance=tool_instance,
        logger=EntityLogger(
            entity_name="tool",
            entity_id=tool_instance.id,
            trace_id=trace_id,
            audit_log_id=audit_log_id,
        ),
        user=user,
        event_sender=EventSender(entity_name="tool"),
        action=action,
    )
