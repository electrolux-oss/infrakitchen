import logging
import shutil
import tempfile

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import IntegrationDTO
from application.executors.crud import ExecutorCRUD
from application.executors.service import ExecutorService
from application.secrets.model import SecretDTO
from application.source_codes.model import SourceCodeDTO
from application.source_codes.service import SourceCodeService
from application.storages.functions import get_tf_storage_config
from application.storages.model import Storage
from application.tools.cloud_api_manager import CloudApiManager
from application.tools.secret_manager import SecretManager
from core.adapters.provider_adapters import IntegrationProvider
from core.config import InfrakitchenConfig
from core.constants import ModelState, ModelStatus
from core.constants.model import ModelActions
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, ExitWithoutSave
from core.tasks.handler import TaskHandler
from core.tools.git_client import GitClient
from core.users.model import UserDTO
from core.utils.entity_state_handler import make_done, make_in_progress
from core.utils.event_sender import EventSender
from ..executors.model import Executor
from ..executors.schema import ExecutorResponse
from ..tools import OtfClient, OtfProvider

logger = logging.getLogger(__name__)


class ExecutorTask:
    def __init__(
        self,
        session: AsyncSession,
        crud_executor: ExecutorCRUD,
        executor_service: ExecutorService,
        executor_instance: Executor,
        source_code_service: SourceCodeService,
        task_handler: TaskHandler,
        logger: EntityLogger,
        secret_manager: SecretManager,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
        workspace_root: str | None = None,
    ) -> None:
        self.session: AsyncSession = session
        self.crud_executor: ExecutorCRUD = crud_executor
        self.event_sender: EventSender = event_sender
        self.logger: EntityLogger = logger
        self.executor_instance: Executor = executor_instance
        self.executor_service: ExecutorService = executor_service
        self.source_code_service: SourceCodeService = source_code_service
        self.source_code_instance: SourceCodeDTO | None = None
        self.user: UserDTO = user
        self.workspace_root: str = workspace_root or tempfile.mkdtemp()
        self.task_handler: TaskHandler = task_handler
        self.action: ModelActions = action
        self.tf_client: OtfClient | None = None
        self.git_client: GitClient | None = None
        self.cloud_api_manager: CloudApiManager = CloudApiManager(
            model_instance=executor_instance,
            logger=logger,
            workspace_root=self.workspace_root,
        )
        self.secret_manager: SecretManager = secret_manager
        self.environment_variables: dict[str, str] = {}
        self.workspace_path: str | None = None

    # workflow states
    async def start_pipeline(self):
        self.logger.debug(
            f"Starting pipeline for {self.executor_instance} {self.executor_instance.id} with action {self.action}"
        )

        if self.action == ModelActions.DRYRUN:
            self.logger.make_expired()

        if hasattr(self.logger, "add_log_header"):
            if self.user:
                self.logger.add_log_header(f"User: {self.user.identifier} Action: {self.action}")

        match self.action:
            case ModelActions.EXECUTE:
                self.logger.info(f"Starting pipeline with action {self.action}")
                await self.execute_entity()
            case ModelActions.DRYRUN:
                await self.dry_run()
            case _:
                raise CannotProceed(f"Unknown action: {self.action}")

    async def init_workspace(self):
        self.logger.info(f"Init workspace at {self.workspace_root}")
        if not self.executor_instance.source_code:
            raise CannotProceed("Source Code is not defined for the Executor")

        if self.source_code_instance is None:
            self.source_code_instance = SourceCodeDTO.model_validate(self.executor_instance.source_code)

        integrations = self.executor_instance.integration_ids

        # get integrations and set environment variables
        for integration in integrations:
            integration_pydantic = IntegrationDTO.model_validate(integration)

            if integration.integration_type == "cloud":
                await self.cloud_api_manager.get_cloud_credentials(integration_pydantic, self.environment_variables)

            if integration.integration_type == "git":
                provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(
                    integration_pydantic.integration_provider
                )
                if not provider_adapter:
                    raise CannotProceed(f"Provider {integration_pydantic.integration_provider} is not supported")
                self.logger.info(f"Authenticating with provider {integration_pydantic.integration_provider}")
                provider_adapter_instance: IntegrationProvider = provider_adapter(
                    **{"logger": self.logger, "configuration": integration_pydantic.configuration}
                )
                provider_adapter_instance.workspace_root = self.workspace_root
                await provider_adapter_instance.authenticate()

                # update environment variables to use git credentials for tofu modules
                self.environment_variables.update(**provider_adapter_instance.environment_variables)
                self.git_client = await provider_adapter_instance.get_git_client(
                    git_url=self.source_code_instance.source_code_url,
                    workspace_root=self.workspace_root,
                    repo_name="source_code_repo",
                )

        # get secrets
        for secret in self.executor_instance.secret_ids:
            pydantic_secret = SecretDTO.model_validate(secret)
            await self.secret_manager.get_credentials(pydantic_secret, self.environment_variables)

        if not self.source_code_instance.integration:
            provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("public")
            if not provider_adapter:
                raise CannotProceed("Public provider is not supported")
            provider_adapter_instance: IntegrationProvider = provider_adapter(**{"logger": self.logger})
        else:
            integration = self.source_code_instance.integration
            integration_pydantic = IntegrationDTO.model_validate(integration)
            if integration_pydantic.integration_type == "git":
                provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(
                    integration_pydantic.integration_provider
                )
                if not provider_adapter:
                    raise CannotProceed(f"Provider {integration_pydantic.integration_provider} is not supported")
                provider_adapter_instance: IntegrationProvider = provider_adapter(
                    **{"logger": self.logger, "configuration": integration_pydantic.configuration}
                )

            else:
                raise CannotProceed(f"Integration type {integration_pydantic.integration_type} is not supported")

        provider_adapter_instance.workspace_root = self.workspace_root
        await provider_adapter_instance.authenticate()

        # update environment variables to use git credentials for tofu modules
        self.environment_variables.update(**provider_adapter_instance.environment_variables)
        self.git_client = await provider_adapter_instance.get_git_client(
            git_url=self.source_code_instance.source_code_url,
            workspace_root=self.workspace_root,
            repo_name="source_code_repo",
        )

        # get source code
        if self.git_client is None:
            raise CannotProceed("Git client is not defined, cannot proceed with source code operations")

        branch = (
            self.executor_instance.source_code_branch
            if self.executor_instance.source_code_branch
            else self.executor_instance.source_code_version
        )
        assert branch is not None, "Branch is not defined"
        await self.git_client.clone_branch(branch=branch)

        self.workspace_path = (
            f"{self.git_client.destination_dir}/{self.executor_instance.source_code_folder}"
            if self.executor_instance.source_code_folder
            else self.git_client.destination_dir
        )

    async def init_provision_tool(self):
        assert self.workspace_path is not None, "Workspace path is not defined"
        assert self.source_code_instance is not None, "Source Code instance is not defined"

        code_language = self.source_code_instance.source_code_language

        if self.tf_client is None and code_language == "opentofu":
            self.logger.info("Initiating Tofu...")
            assert self.executor_instance.storage_path is not None, "Storage path is not defined"
            assert self.executor_instance.storage_id is not None, "Storage ID is not defined"
            storage = await self.session.get(Storage, self.executor_instance.storage_id)
            if not storage:
                raise CannotProceed("Backend Storage is not defined")

            otf_provider = OtfProvider(self.workspace_path)

            tf_data = await otf_provider.parse_tf_directory_to_json()
            await otf_provider.setup_tf_backend(tf_data, self.executor_instance.storage.storage_provider)

            self.tf_client = OtfClient(
                self.workspace_path,
                environment_variables=self.environment_variables,
                variables={},
                backend_storage_config=get_tf_storage_config(storage, self.executor_instance.storage_path),
                logger=self.logger,
            )

            assert self.tf_client is not None, "Tofu client is not defined"

            self.tf_client.variables = {}
            await self.tf_client.init_tf_workspace()

    async def post_create_task_run(self):
        pass

    async def post_destroy_task_run(self):
        pass

    async def clean_workspace(self):
        if self.workspace_path is not None:
            shutil.rmtree(self.workspace_path, ignore_errors=True)
            self.logger.info(f"Workspace {self.workspace_path} is cleaned up")

    async def create(self) -> None:
        assert self.workspace_path is not None, "Workspace path is not defined"
        assert self.source_code_instance is not None, "Source Code instance is not defined"

        code_language = self.source_code_instance.source_code_language
        if code_language == "opentofu":
            assert self.tf_client is not None, "Tofu client is not defined"
            await self.tf_client.init()
            if InfrakitchenConfig().demo_mode is True:
                self.logger.warning("Demo mode is enabled, skipping apply")
                command_args = self.executor_instance.command_args
                await self.tf_client.dry_run(command_args=command_args)
            else:
                command_args = f"-auto-approve=true {self.executor_instance.command_args}"
                await self.tf_client.apply(command_args=command_args)
        await self.post_create_task_run()

    async def update(self) -> None:
        await self.create()

    async def destroy(self) -> None:
        assert self.workspace_path is not None, "Workspace path is not defined"
        assert self.source_code_instance is not None, "Source Code instance is not defined"

        code_language = self.source_code_instance.source_code_language
        if code_language == "opentofu":
            self.logger.info("Run destroy Tofu command...")
            assert self.tf_client is not None, "Tofu client is not defined"

            await self.tf_client.init()
            if InfrakitchenConfig().demo_mode is True:
                self.logger.warning("Demo mode is enabled, skipping destroy")
            else:
                command_args = f"-auto-approve=true {self.executor_instance.command_args}"
                await self.tf_client.destroy(command_args=command_args)
                await self.post_destroy_task_run()

    # change entity state depends on task state
    async def change_entity_status(
        self,
        new_status: ModelStatus | None = None,
        new_state: ModelState | None = None,
        event_type: str = ModelActions.EXECUTE,
    ) -> None:
        if new_status:
            self.executor_instance.status = new_status
        if new_state:
            self.executor_instance.state = new_state

        if hasattr(self.logger, "save_log"):
            await self.logger.save_log()

        await self.task_handler.update_task(status=self.executor_instance.status, state=self.executor_instance.state)
        await self.session.commit()
        await self.crud_executor.refresh(self.executor_instance)

        response_model = ExecutorResponse.model_validate(self.executor_instance)
        await self.event_sender.send_event(response_model, event_type)

    async def make_failed(self) -> None:
        if self.executor_instance.state == ModelState.DESTROYED:
            return None
        await self.change_entity_status(new_status=ModelStatus.ERROR)

    async def make_retry(self, retry: int, max_retries: int):
        if self.executor_instance.status == ModelStatus.IN_PROGRESS:
            await self.change_entity_status(new_status=ModelStatus.ERROR)

    async def execute_entity(self):
        self.logger.debug(
            f"Executing Executor ID: {self.executor_instance.id} {self.executor_instance.state}"  # noqa
        )
        if self.executor_instance.status in [
            ModelStatus.ERROR,
            ModelStatus.DONE,
            ModelStatus.READY,
            ModelStatus.QUEUED,
        ]:
            match self.executor_instance.state:
                case ModelState.PROVISION:
                    await self.init_workspace()
                    await self.create_state()
                case ModelState.PROVISIONED:
                    await self.init_workspace()
                    await self.update_state()
                case ModelState.DESTROY:
                    await self.init_workspace()
                    await self.destroy_state()
                case _:
                    raise ExitWithoutSave(f"Entity cannot be executed, has wrong state {self.executor_instance.state}")
        else:
            raise ExitWithoutSave(f"Entity cannot be executed, has wrong status {self.executor_instance.state}")

    async def create_state(self):
        make_in_progress(self.executor_instance)
        await self.change_entity_status(event_type=ModelActions.CREATE)
        await self.init_provision_tool()
        await self.create()
        make_done(self.executor_instance)
        self.logger.info("Create task is done")
        await self.change_entity_status()
        await self.clean_workspace()

    async def update_state(self):
        make_in_progress(self.executor_instance)
        await self.change_entity_status(event_type=ModelActions.UPDATE)
        await self.init_provision_tool()
        await self.update()

        make_done(self.executor_instance)
        self.logger.info("Update task is done")
        await self.change_entity_status()
        await self.clean_workspace()

    async def destroy_state(self):
        make_in_progress(self.executor_instance)
        await self.change_entity_status(event_type=ModelActions.DESTROY)
        await self.init_provision_tool()
        await self.destroy()
        make_done(self.executor_instance)
        self.logger.info("Destroy task is done")
        await self.change_entity_status()
        await self.clean_workspace()

    async def dry_run(self):
        # dry run should not change the state of the executor
        if hasattr(self.logger, "add_dry_run"):
            self.logger.add_dry_run()
        else:
            self.logger.info("Run dry-run")

        try:
            await self.init_workspace()
            await self.init_provision_tool()

            assert self.workspace_path is not None, "Workspace path is not defined"
            assert self.source_code_instance is not None, "Source Code instance is not defined"

            code_language = self.source_code_instance.source_code_language
            if code_language == "opentofu":
                assert self.tf_client is not None
                await self.tf_client.init()
                # if destroy is True, plan destroy
                command_args = self.executor_instance.command_args
                await self.tf_client.dry_run(
                    command_args=command_args, destroy=self.executor_instance.state == ModelState.DESTROY
                )
                await self.clean_workspace()
        except Exception as e:
            await self.clean_workspace()
            raise ExitWithoutSave(e) from e
