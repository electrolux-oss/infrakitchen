import logging
import tempfile

from sqlalchemy.ext.asyncio import AsyncSession

from application.storages.model import Storage
from application.storages.crud import StorageCRUD
from application.storages.schema import StorageResponse
from application.tools.storage_manager import StorageManager
from core.adapters.provider_adapters import StorageProviderAdapter
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.tasks.handler import TaskHandler
from core.utils.entity_state_handler import make_done, make_in_progress
from core.utils.event_sender import EventSender

from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, ExitWithoutSave
from core.users.model import UserDTO

from ..storages import StorageDTO


logger = logging.getLogger(__name__)


class StorageTask:
    def __init__(
        self,
        session: AsyncSession,
        crud_storage: StorageCRUD,
        storage_instance: Storage,
        task_handler: TaskHandler,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
        workspace_root: str | None = None,
    ) -> None:
        self.session: AsyncSession = session
        self.crud_storage: StorageCRUD = crud_storage
        self.event_sender: EventSender = event_sender
        self.logger: EntityLogger = logger
        self.storage_instance: Storage = storage_instance
        self.user: UserDTO = user
        self.workspace_root: str = workspace_root or tempfile.mkdtemp()
        self.task_handler: TaskHandler = task_handler
        self.action: ModelActions = action
        self.storage_manager: StorageManager = StorageManager(
            model_instance=storage_instance,
            logger=logger,
            workspace_root=self.workspace_root,
        )
        self.storage_provider: StorageProviderAdapter | None = None
        self.environment_variables: dict[str, str] = {}

    # workflow states
    async def start_pipeline(self):
        """Default pipeline"""
        self.logger.debug(
            f"Starting pipeline for {self.storage_instance} {self.storage_instance.id} with action {self.action}"  # noqa
        )

        if hasattr(self.logger, "add_log_header"):
            if self.user:
                self.logger.add_log_header(f"User: {self.user.identifier} Action: {self.action}")

        if self.storage_instance.status not in [
            ModelStatus.ERROR,
            ModelStatus.DONE,
            ModelStatus.READY,
            ModelStatus.QUEUED,
        ]:
            raise CannotProceed(f"Entity has wrong status {self.storage_instance.status}")

        match self.action:
            case ModelActions.EXECUTE:
                self.logger.info(f"Starting pipeline with action {self.action}")

                response_model = StorageResponse.model_validate(self.storage_instance)
                await self.event_sender.send_event(response_model, ModelActions.EXECUTE)
                await self.execute_entity()
            case _:
                raise CannotProceed(f"Unknown action: {self.action}")

    async def init_workspace(self):
        self.logger.info(f"Init workspace at {self.workspace_root}")
        storage = StorageDTO.model_validate(self.storage_instance)
        integration = storage.integration
        if not integration:
            raise CannotProceed("Integration not found")
        await self.storage_manager.get_cloud_credentials(integration, self.environment_variables)

    async def init_cloud_backend_provider(self):
        if not self.storage_provider:
            self.logger.info("Initializing cloud backend provider")
            storage = StorageDTO.model_validate(self.storage_instance)
            self.storage_provider = await self.storage_manager.get_storage_provider(
                self.storage_instance.storage_provider,
                storage.configuration,
                environment_variables=self.environment_variables,
            )

    async def create(self) -> None:
        if not self.storage_provider:
            self.logger.warning("Storage provider is not initialized, skipping destroy")
            raise CannotProceed("Storage provider is not initialized")
        await self.storage_provider.create()

    async def destroy(self) -> None:
        if not self.storage_provider:
            self.logger.warning("Storage provider is not initialized, skipping destroy")
            raise CannotProceed("Storage provider is not initialized")
        await self.storage_provider.destroy()

    # change entity state depends on task state
    async def change_entity_status(
        self,
        new_status: ModelStatus | None = None,
        new_state: ModelState | None = None,
        event_type: str = ModelActions.EXECUTE,
    ) -> None:
        if new_status:
            self.storage_instance.status = new_status
        if new_state:
            self.storage_instance.state = new_state

        if hasattr(self.logger, "save_log"):
            await self.logger.save_log()

        await self.task_handler.update_task(status=self.storage_instance.status, state=self.storage_instance.state)
        await self.session.commit()
        await self.crud_storage.refresh(self.storage_instance)
        response_model = StorageResponse.model_validate(self.storage_instance)
        await self.event_sender.send_event(response_model, event_type)

    async def make_failed(self) -> None:
        if self.storage_instance.state == ModelState.DESTROYED:
            return None
        await self.change_entity_status(new_status=ModelStatus.ERROR)

    async def make_retry(self, retry: int, max_retries: int):
        if self.storage_instance.status == ModelStatus.IN_PROGRESS:
            await self.change_entity_status(new_status=ModelStatus.ERROR)

    async def execute_entity(self):
        self.logger.debug(
            f"Executing Storage ID: {self.storage_instance.id} {self.storage_instance.state}"  # noqa
        )
        if self.storage_instance.status in [ModelStatus.ERROR, ModelStatus.DONE, ModelStatus.READY, ModelStatus.QUEUED]:
            if self.storage_instance.state in [ModelState.PROVISION, ModelState.PROVISIONED]:
                await self.init_workspace()
                await self.sync_state()
            elif self.storage_instance.state == ModelState.DESTROY:
                await self.init_workspace()
                await self.destroy_state()
            else:
                raise ExitWithoutSave(f"Entity cannot be executed, has wrong state {self.storage_instance.state}")

        else:
            raise ExitWithoutSave(f"Entity cannot be executed, has wrong status {self.storage_instance.state}")

    async def sync_state(self):
        make_in_progress(self.storage_instance)
        await self.change_entity_status(event_type=ModelActions.SYNC)
        await self.init_cloud_backend_provider()
        await self.create()
        make_done(self.storage_instance)
        self.logger.info("Create task is done")
        await self.change_entity_status()

    async def destroy_state(self):
        make_in_progress(self.storage_instance)
        await self.change_entity_status(event_type=ModelActions.DESTROY)
        await self.init_cloud_backend_provider()
        await self.destroy()
        make_done(self.storage_instance)
        self.logger.info("Destroy task is done")
        await self.change_entity_status()
