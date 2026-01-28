import asyncio
import logging
from typing import override
from uuid import UUID

from aio_pika import ExchangeType
from sqlalchemy.ext.asyncio import AsyncSession

from application.executors.task import ExecutorTask
from application.resources.task import ResourceTask
from application.source_code_versions.task import SourceCodeVersionTask
from application.source_codes.task import SourceCodeTask
from application.storages.task import StorageTask
from application.workers.utils import (
    get_executor_task,
    get_source_code_task,
    get_source_code_version_task,
    get_storage_task,
    get_resource_task,
    get_workspace_task,
)
from application.workspaces.task import WorkspaceTask
from core import BaseMessagesWorker, MessageHandler, MessageModel
from core.constants.model import ModelActions
from core.custom_notification_controller import create_message, send_message
from core.errors import (
    CannotProceed,
    ChildrenIsNotReady,
    EntityWrongState,
    ExitWithoutSave,
    ParentIsNotReady,
    TaskFailure,
)
from core.scheduler.executor import SchedulerExecutor
from core.users.dependencies import get_user_service
from core.users.model import UserDTO

logger = logging.getLogger("TaskWorker")


class TaskWorker(BaseMessagesWorker):
    def __init__(self, session: AsyncSession, name: str, lock: asyncio.Lock) -> None:
        exchange_name = "ik_tasks"
        exchange_type = ExchangeType.DIRECT

        self.user_service = get_user_service(session=session)

        super().__init__(
            session,
            name,
            lock=lock,
            exchange_name=exchange_name,
            exchange_type=exchange_type,
            logger=logger,
            exclusive=False,
            durable=True,
            auto_delete=False,
            commit_worker_status=True,
        )

    @override
    async def process_message(self, message: MessageHandler) -> None:
        msg = MessageModel.load_from_bytes(message.raw_body)

        if msg.message_type == "scheduler_job":
            await self.process_scheduler_job(msg)
            return

        action = msg.metadata.get("action")
        if not action:
            raise CannotProceed("Action is not defined in message")

        obj_id = msg.metadata.get("id")
        if not obj_id:
            raise CannotProceed("InventoryId is not defined in message")

        user_id = msg.metadata.get("user")
        if not user_id:
            raise CannotProceed("User is not defined in message")

        entity_controller = msg.metadata.get("entity_controller")
        if not entity_controller:
            raise CannotProceed("Entity controller is not defined in message")

        user = await self.user_service.get_dto_by_id(user_id)
        if not user:
            raise CannotProceed(f"User {user_id} not found")

        trace_id = msg.metadata.get("trace_id")

        task_controller = await self.get_task_controller(
            entity_controller=entity_controller, obj_id=obj_id, user=user, action=action, trace_id=trace_id
        )
        # Main task flow
        try:
            await task_controller.start_pipeline()
            await self._send_success_notification(task_controller, action)
        except Exception as e:
            await self.handle_exception(e, message, task_controller)

    async def process_scheduler_job(self, msg: MessageModel):
        job_id = msg.body.get("job_id")
        if not job_id:
            raise CannotProceed("Scheduler job_id is not defined in message")

        job_type = msg.body.get("job_type")
        if not job_type:
            raise CannotProceed("Scheduler job_type is not defined in message")

        job_script = msg.body.get("job_script")
        if not job_script:
            raise CannotProceed("Scheduler job_script is not defined in message")

        job_executor = SchedulerExecutor(self.session)

        await job_executor.execute(job_type=job_type, script=job_script)

    async def get_task_controller(
        self, entity_controller: str, obj_id: UUID, user: UserDTO, action: ModelActions, trace_id: str | None = None
    ) -> SourceCodeTask | SourceCodeVersionTask | StorageTask | ResourceTask | WorkspaceTask | ExecutorTask:
        match entity_controller:
            case "source_code":
                return await get_source_code_task(
                    session=self.session, obj_id=obj_id, user=user, action=action, trace_id=trace_id
                )
            case "source_code_version":
                return await get_source_code_version_task(
                    session=self.session, obj_id=obj_id, user=user, action=action, trace_id=trace_id
                )
            case "storage":
                return await get_storage_task(
                    session=self.session, obj_id=obj_id, user=user, action=action, trace_id=trace_id
                )
            case "resource":
                return await get_resource_task(
                    session=self.session, obj_id=obj_id, user=user, action=action, trace_id=trace_id
                )
            case "workspace":
                return await get_workspace_task(
                    session=self.session, obj_id=obj_id, user=user, action=action, trace_id=trace_id
                )
            case "executor":
                return await get_executor_task(
                    session=self.session, obj_id=obj_id, user=user, action=action, trace_id=trace_id
                )
            case _:
                raise CannotProceed(f"Unknown entity controller: {entity_controller}")

    async def handle_is_not_ready_exception(self, e, message, task_controller):
        message.max_retries = 3
        message.delay = 1000 * 1
        task_controller.logger.warning(f"{message.retries}/{message.max_retries} {e}")
        if message.retries >= message.max_retries:
            task_controller.logger.error("Task is timed out")
            await task_controller.make_failed()
            await task_controller.logger.save_log()
            await self.send_task_notification(
                task_controller, f"Task failed for {task_controller.logger.entity_id}: Task is timed out"
            )
            raise TaskFailure from e
        await task_controller.make_retry(message.retries, message.max_retries)
        await task_controller.logger.save_log()
        await self.on_failure(message)

    async def handle_is_not_right_state_exception(self, e, message, task_controller):
        message.max_retries = 3
        message.delay = 1000 * 1
        if message.retries >= message.max_retries:
            task_controller.logger.error("Task is timed out")
            await task_controller.make_failed()
            await task_controller.logger.save_log()
            await self.send_task_notification(
                task_controller, f"Task failed for {task_controller.logger.entity_id}: Task is timed out"
            )
            raise TaskFailure from e
        await task_controller.logger.save_log()
        await self.on_failure(message)

    async def handle_generic_exception(self, e, task_controller, error_type):
        task_controller.logger.error(f"{error_type}: {e}")
        await task_controller.make_failed()
        await task_controller.logger.save_log()
        await self.send_task_notification(
            task_controller, f"Task failed for {task_controller.logger.entity_id}: {error_type}"
        )
        raise TaskFailure from e

    async def handle_exit_without_state_exception(self, e, task_controller):
        error_message = f"ExitWithoutSave: {e}"
        task_controller.logger.error(error_message)
        await task_controller.logger.save_log()
        await self.send_task_notification(
            task_controller, f"Task failed for {task_controller.logger.entity_id}: {error_message}"
        )
        raise TaskFailure from e

    async def handle_unexpected_exception(self, e, task_controller):
        task_controller.logger.error("Unhandled exception occurred")
        await task_controller.make_failed()
        await task_controller.logger.save_log()

        error_message = f"UnhandledException: {e}"
        logger.error(f"Unhandled exception: {e}", exc_info=True)
        await self.send_task_notification(
            task_controller, f"Task failed for {task_controller.logger.entity_id}: {error_message}"
        )
        raise TaskFailure from e

    async def send_task_notification(self, task_controller, message: str):
        entity_id = task_controller.logger.entity_id
        entity_name = task_controller.logger.entity_name
        user_id = str(task_controller.user.id)

        logger.debug(f"Sending notification - entity_id: {entity_id}, entity_name: {entity_name}, user_id: {user_id}")

        notification_message = create_message(body={"msg": message}, entity_name=entity_name, user_id=user_id)
        await send_message(notification_message)
        logger.debug(f"Notification sent: {notification_message}")

    async def _send_success_notification(self, task_controller, action):
        notification_message = f"Task {action} for {task_controller.logger.entity_name} completed successfully."
        await self.send_task_notification(task_controller, notification_message)

    async def handle_exception(self, e, message, task_controller):
        if isinstance(e, ParentIsNotReady) or isinstance(e, ChildrenIsNotReady):
            await self.handle_is_not_ready_exception(e, message, task_controller)
        elif isinstance(e, EntityWrongState):
            await self.handle_is_not_right_state_exception(e, message, task_controller)
        elif isinstance(e, CannotProceed):
            await self.handle_generic_exception(e, task_controller, "CannotProceed")
        elif isinstance(e, ExitWithoutSave):
            await self.handle_exit_without_state_exception(e, task_controller)
        elif isinstance(e, AssertionError):
            await self.handle_generic_exception(e, task_controller, "AssertionError")
        else:
            await self.handle_unexpected_exception(e, task_controller)
