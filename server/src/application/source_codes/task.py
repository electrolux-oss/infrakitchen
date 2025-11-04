import logging
from glob import glob
import tempfile

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import IntegrationDTO
from application.source_codes.crud import SourceCodeCRUD
from application.source_codes.schema import SourceCodeResponse
from core.tools.git_client import GitClient
from core.adapters.provider_adapters import IntegrationProvider
from core.constants.model import ModelActions, ModelStatus
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, ExitWithoutSave
from core.tasks.handler import TaskHandler
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from ..source_codes.model import RefFolders, SourceCode


logger = logging.getLogger(__name__)


class SourceCodeTask:
    def __init__(
        self,
        session: AsyncSession,
        crud_source_code: SourceCodeCRUD,
        source_code_instance: SourceCode,
        task_handler: TaskHandler,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
        workspace_root: str | None = None,
    ) -> None:
        self.session: AsyncSession = session
        self.crud_source_code: SourceCodeCRUD = crud_source_code
        self.event_sender: EventSender = event_sender
        self.logger: EntityLogger = logger
        self.source_code_instance: SourceCode = source_code_instance
        self.user: UserDTO = user
        self.workspace_root: str = workspace_root or tempfile.mkdtemp()
        self.task_handler: TaskHandler = task_handler
        self.action: ModelActions = action
        self.git_client: GitClient | None = None
        self.environment_variables: dict[str, str] = {}

    # workflow states
    async def start_pipeline(self):
        """Default pipeline"""
        self.logger.debug(
            f"Starting pipeline for {self.source_code_instance} {self.source_code_instance.id} with action {self.action}"  # noqa
        )

        if hasattr(self.logger, "add_log_header"):
            if self.user:
                self.logger.add_log_header(f"User: {self.user.identifier} Action: {self.action}")

        match self.action:
            case ModelActions.SYNC:
                self.logger.info(f"Starting pipeline with action {self.action}")
                await self.sync_entity()
            case _:
                raise CannotProceed(f"Unknown action: {self.action}")

    async def init_workspace(self):
        self.logger.info(f"Init workspace at {self.workspace_root}")
        # Authentication is not required for public repositories
        if not self.source_code_instance.integration:
            provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("public")
            if not provider_adapter:
                raise CannotProceed("Public provider is not supported")
            provider_adapter_instance: IntegrationProvider = provider_adapter(**{"logger": self.logger})
        else:
            integration = self.source_code_instance.integration
            if integration.integration_type == "git":
                integration_pydantic = IntegrationDTO.model_validate(integration)
                provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(
                    integration_pydantic.integration_provider
                )
                if not provider_adapter:
                    raise CannotProceed(f"Provider {integration_pydantic.integration_provider} is not supported")
                self.logger.info(f"Authenticating with provider {integration_pydantic.integration_provider}")
                provider_adapter_instance: IntegrationProvider = provider_adapter(
                    **{"logger": self.logger, "configuration": integration_pydantic.configuration}
                )
            else:
                raise CannotProceed(f"Integration type {integration.integration_type} is not supported for source code")

        provider_adapter_instance.workspace_root = self.workspace_root
        await provider_adapter_instance.authenticate()
        self.git_client = await provider_adapter_instance.get_git_client(
            git_url=self.source_code_instance.source_code_url,
            workspace_root=self.workspace_root,
            repo_name="source_code_repo",
        )

    async def get_source_code_data(self):
        if not self.git_client:
            raise CannotProceed("Git client is not initialized. Cannot fetch source code data.")

        await self.git_client.clone()
        git_tags = await self.git_client.get_repo_tags()
        git_tag_messages = await self.git_client.get_repo_tag_messages()
        git_branches = await self.git_client.get_repo_branches()
        git_branch_messages = await self.git_client.get_repo_branch_messages()

        self.source_code_instance.git_tags = git_tags
        self.source_code_instance.git_tag_messages = git_tag_messages
        self.source_code_instance.git_branches = git_branches
        self.source_code_instance.git_branch_messages = git_branch_messages
        self.source_code_instance.git_folders_map = []
        working_tree_dir = self.git_client.destination_dir
        for ref in self.source_code_instance.git_tags + self.source_code_instance.git_branches:
            await self.git_client.checkout(ref)
            res = glob(f"{working_tree_dir}/**/", recursive=True)
            self.logger.info(f"Found repository folders for {ref}: {len(res)}")
            folders = []
            for folder in res:
                branch_folder = folder.replace(f"{working_tree_dir}/", "")
                if branch_folder != "":
                    folders.append(branch_folder)
                else:
                    folders.append("/")

            ref_folders = RefFolders(ref=ref, folders=folders).model_dump()
            self.source_code_instance.git_folders_map.append(ref_folders)
        await self.git_client.delete_workspace()

    # change entity state depends on task state
    async def change_entity_status(self, new_state: ModelStatus) -> None:
        self.source_code_instance.status = new_state
        if hasattr(self.logger, "save_log"):
            await self.logger.save_log()

        await self.task_handler.update_task(status=self.source_code_instance.status)
        await self.session.commit()
        await self.crud_source_code.refresh(self.source_code_instance)
        response_model = SourceCodeResponse.model_validate(self.source_code_instance)
        await self.event_sender.send_event(response_model, ModelActions.SYNC)

    async def make_failed(self) -> None:
        await self.change_entity_status(ModelStatus.ERROR)

    async def make_retry(self, retry: int, max_retries: int):
        if self.source_code_instance.status == ModelStatus.IN_PROGRESS:
            await self.change_entity_status(ModelStatus.ERROR)

    async def sync_entity(self):
        self.logger.debug(f"Syncing entity SourceCode ID: {self.source_code_instance.id}")
        if self.source_code_instance.status in [ModelStatus.ERROR, ModelStatus.DONE, ModelStatus.READY]:
            await self.init_workspace()
            await self.sync_state()
        else:
            raise ExitWithoutSave(f"Entity cannot be synced, has wrong status {self.source_code_instance.status}")

    async def sync_state(self):
        await self.change_entity_status(ModelStatus.IN_PROGRESS)
        await self.get_source_code_data()
        self.logger.info("Sync task is done")
        await self.change_entity_status(ModelStatus.DONE)
