import logging
import os
import shutil
import tempfile

import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import IntegrationDTO
from application.resources.crud import ResourceCRUD
from application.resources.functions import get_merged_tags
from application.resources.service import ResourceService
from application.source_code_versions.model import SourceCodeVersionDTO
from application.source_code_versions.service import SourceCodeVersionService
from application.source_codes.model import SourceCodeDTO
from application.storages.functions import get_tf_storage_config
from application.storages.model import Storage
from application.tools.cloud_api_manager import CloudApiManager
from application.tools.secret_manager import SecretManager
from core.adapters.provider_adapters import IntegrationProvider
from core.config import InfrakitchenConfig
from core.constants import ModelState, ModelStatus
from core.constants.model import ModelActions
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, ChildrenIsNotReady, ExitWithoutSave, ParentIsNotReady
from application.resource_temp_state.model import ResourceTempStateDTO
from core.tasks.handler import TaskHandler
from core.tools.git_client import GitClient
from core.users.model import UserDTO
from core.utils.entity_state_handler import make_done, make_in_progress
from core.utils.event_sender import EventSender
from ..resources.model import Resource, ResourceDTO
from ..resources.schema import Outputs, ResourceResponse
from ..tools import OtfClient, OtfProvider

logger = logging.getLogger(__name__)


class ResourceTask:
    def __init__(
        self,
        session: AsyncSession,
        crud_resource: ResourceCRUD,
        resource_service: ResourceService,
        resource_instance: Resource,
        source_code_version_service: SourceCodeVersionService,
        task_handler: TaskHandler,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        workspace_event_sender: EventSender,
        action: ModelActions,
        resource_temp_state_instance: ResourceTempStateDTO | None = None,
        workspace_root: str | None = None,
    ) -> None:
        self.session: AsyncSession = session
        self.crud_resource: ResourceCRUD = crud_resource
        self.event_sender: EventSender = event_sender
        self.workspace_event_sender: EventSender = workspace_event_sender
        self.logger: EntityLogger = logger
        self.resource_instance: Resource = resource_instance
        self.resource_temp_state_dto: ResourceTempStateDTO | None = resource_temp_state_instance
        self.resource_service: ResourceService = resource_service
        self.source_code_version_service: SourceCodeVersionService = source_code_version_service
        self.source_code_instance: SourceCodeDTO | None = None
        self.source_code_version_instance: SourceCodeVersionDTO | None = None
        self.user: UserDTO = user
        self.workspace_root: str = workspace_root or tempfile.mkdtemp()
        self.task_handler: TaskHandler = task_handler
        self.action: ModelActions = action
        self.tf_client: OtfClient | None = None
        self.git_client: GitClient | None = None
        self.cloud_api_manager: CloudApiManager = CloudApiManager(
            model_instance=resource_instance,
            logger=logger,
            workspace_root=self.workspace_root,
        )
        self.secret_manager: SecretManager = SecretManager(
            model_instance=resource_instance,
            logger=logger,
            workspace_root=self.workspace_root,
        )
        self.environment_variables: dict[str, str] = {}
        self.workspace_path: str | None = None

    # workflow states
    async def start_pipeline(self):
        """Default pipeline"""
        self.logger.debug(
            f"Starting pipeline for {self.resource_instance} {self.resource_instance.id} with action {self.action}"
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
            case ModelActions.DRYRUN_WITH_TEMP_STATE:
                if not self.resource_temp_state_dto:
                    raise CannotProceed("Temporary state is not found for dry run with temp state")
                await self.dry_run()
            case _:
                raise CannotProceed(f"Unknown action: {self.action}")

    async def init_workspace(self):
        self.logger.info(f"Init workspace at {self.workspace_root}")

        if self.source_code_version_instance is None:
            if not self.resource_instance.source_code_version_id:
                raise CannotProceed("Resource is not linked to Source Code Version")

            resource_dto = ResourceDTO.model_validate(self.resource_instance)

            self.source_code_version_instance = resource_dto.source_code_version
            if not self.source_code_version_instance:
                raise CannotProceed("Version is not defined")

        if self.source_code_instance is None:
            if (
                self.resource_temp_state_dto
                and self.action == ModelActions.DRYRUN_WITH_TEMP_STATE
                and self.resource_temp_state_dto.value.get("source_code_version_id")
            ):
                if self.resource_temp_state_dto.value.get("source_code_version_id") != str(
                    self.source_code_version_instance.id
                ):
                    # in case source code version is changed in temp state, use the one from temp state
                    temporary_state_source_code_version = await self.source_code_version_service.get_dto_by_id(
                        self.resource_temp_state_dto.value["source_code_version_id"]
                    )
                    if not temporary_state_source_code_version:
                        raise CannotProceed("Source Code Version ID in temporary state does not exist in the system")
                    self.source_code_version_instance = temporary_state_source_code_version

            self.source_code_instance = self.source_code_version_instance.source_code

            if not self.source_code_instance:
                raise CannotProceed("Source Code is not defined")

        integrations = self.resource_instance.integration_ids

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

            if integration.integration_type == "credentials":
                await self.secret_manager.get_credentials(integration_pydantic, self.environment_variables)

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
            self.source_code_version_instance.source_code_branch
            if self.source_code_version_instance.source_code_branch
            else self.source_code_version_instance.source_code_version
        )
        assert branch is not None, "Branch is not defined"
        await self.git_client.clone_branch(branch=branch)

        self.workspace_path = (
            f"{self.git_client.destination_dir}/{self.source_code_version_instance.source_code_folder}"
            if self.source_code_version_instance.source_code_folder
            else self.git_client.destination_dir
        )

    async def parent_resource_is_ready(self):
        parents = self.resource_instance.parents
        for ref_item in parents:
            if ref_item.state != ModelState.PROVISIONED and ref_item.status != ModelStatus.DONE:
                raise ParentIsNotReady(
                    f"Parent 'Resource' (ID: {ref_item.id}) is not ready. Has {ref_item.state} state"  # noqa
                )

    async def children_resource_is_destroyed(self):
        children_resources = self.resource_instance.children
        for ref_item in children_resources:
            if ref_item.state != ModelState.DESTROYED and ref_item.status != ModelStatus.DONE:
                raise ChildrenIsNotReady(
                    f"Children 'Resource' (ID: {ref_item.id}) is not ready. Has {ref_item.state} state"  # noqa
                )

    async def init_provision_tool(self):
        assert self.workspace_path is not None, "Workspace path is not defined"
        assert self.source_code_instance is not None, "Source Code instance is not defined"

        code_language = self.source_code_instance.source_code_language

        parents = await self.resource_service.get_parents_with_configs(self.resource_instance.id)
        variables = {}
        merged_tags = get_merged_tags(parents)
        if merged_tags:
            variables.update({"tags": merged_tags})

        if self.resource_instance.variables:
            for v in ResourceDTO.model_validate(self.resource_instance).variables:
                if v.name == "tags":
                    variables.update(**{v.name: {**merged_tags, **v.value}})
                else:
                    variables.update(**{v.name: v.value})

        if self.resource_temp_state_dto and self.action == ModelActions.DRYRUN_WITH_TEMP_STATE:
            temp_state_variables = self.resource_temp_state_dto.value.get("variables", [])
            if temp_state_variables:
                for v in temp_state_variables:
                    if v.get("name") == "tags":
                        variables.update({"tags": {**merged_tags, **v.get("value", {})}})
                    else:
                        variables.update({v["name"]: v["value"]})

        if self.tf_client is None and code_language == "opentofu":
            self.logger.info("Initiating Tofu...")
            assert self.resource_instance.storage_path is not None, "Storage path is not defined"
            assert self.resource_instance.storage_id is not None, "Storage ID is not defined"
            storage = await self.session.get(Storage, self.resource_instance.storage_id)
            if not storage:
                raise CannotProceed("Backend Storage is not defined")

            otf_provider = OtfProvider(self.workspace_path)

            tf_data = await otf_provider.parse_tf_directory_to_json()
            await otf_provider.setup_tf_backend(tf_data, self.resource_instance.storage.storage_provider)

            self.tf_client = OtfClient(
                self.workspace_path,
                environment_variables=self.environment_variables,
                variables=variables,
                backend_storage_config=get_tf_storage_config(storage, self.resource_instance.storage_path),
                logger=self.logger,
            )

            assert self.tf_client is not None, "Tofu client is not defined"

            self.tf_client.variables = variables
            await self.tf_client.init_tf_workspace()

    async def post_create_task_run(self):
        assert self.workspace_path is not None, "Workspace path is not defined"
        assert self.source_code_instance is not None, "Source Code instance is not defined"
        assert self.tf_client is not None, "Tofu client is not defined"
        code_language = self.source_code_instance.source_code_language
        if code_language == "opentofu":
            output_result = await self.tf_client.get_output()
            # save output to the model
            outputs: list[Outputs] = []
            for key in output_result:
                outputs.append(
                    Outputs(
                        name=key,
                        value=output_result[key]["value"],
                        sensitive=output_result[key]["sensitive"],
                    )
                )
            self.resource_instance.outputs = [output.model_dump() for output in outputs]

    async def post_destroy_task_run(self):
        assert self.source_code_instance is not None, "Source Code instance is not defined"
        code_language = self.source_code_instance.source_code_language
        if code_language == "opentofu":
            self.resource_instance.outputs = []

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
                await self.tf_client.dry_run()
            else:
                await self.tf_client.apply()
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
                await self.tf_client.destroy()
                await self.post_destroy_task_run()

    # change entity state depends on task state
    async def change_entity_status(
        self,
        new_status: ModelStatus | None = None,
        new_state: ModelState | None = None,
        event_type: str = ModelActions.EXECUTE,
    ) -> None:
        if new_status:
            self.resource_instance.status = new_status
        if new_state:
            self.resource_instance.state = new_state

        if hasattr(self.logger, "save_log"):
            await self.logger.save_log()

        await self.task_handler.update_task(status=self.resource_instance.status, state=self.resource_instance.state)
        await self.session.commit()
        await self.crud_resource.refresh(self.resource_instance)

        response_model = ResourceResponse.model_validate(self.resource_instance)
        await self.event_sender.send_event(response_model, event_type)

    async def make_failed(self) -> None:
        if self.resource_instance.state == ModelState.DESTROYED:
            return None
        await self.change_entity_status(new_status=ModelStatus.ERROR)

    async def make_retry(self, retry: int, max_retries: int):
        if self.resource_instance.status == ModelStatus.IN_PROGRESS:
            await self.change_entity_status(new_status=ModelStatus.ERROR)

    async def execute_entity(self):
        self.logger.debug(
            f"Executing Resource ID: {self.resource_instance.id} {self.resource_instance.state}"  # noqa
        )
        if self.resource_instance.status in [
            ModelStatus.ERROR,
            ModelStatus.DONE,
            ModelStatus.READY,
            ModelStatus.QUEUED,
        ]:
            match self.resource_instance.state:
                case ModelState.PROVISION:
                    await self.parent_resource_is_ready()
                    await self.init_workspace()
                    await self.create_state()
                case ModelState.PROVISIONED:
                    await self.parent_resource_is_ready()
                    await self.init_workspace()
                    await self.update_state()
                case ModelState.DESTROY:
                    await self.children_resource_is_destroyed()
                    await self.init_workspace()
                    await self.destroy_state()
                case _:
                    raise ExitWithoutSave(f"Entity cannot be executed, has wrong state {self.resource_instance.state}")
        else:
            raise ExitWithoutSave(f"Entity cannot be executed, has wrong status {self.resource_instance.state}")

    async def create_state(self):
        make_in_progress(self.resource_instance)
        await self.change_entity_status(event_type=ModelActions.CREATE)
        await self.init_provision_tool()
        await self.create()
        make_done(self.resource_instance)
        self.logger.info("Create task is done")
        await self.change_entity_status()
        await self.clean_workspace()

    async def update_state(self):
        make_in_progress(self.resource_instance)
        await self.change_entity_status(event_type=ModelActions.UPDATE)
        await self.init_provision_tool()
        await self.update()

        make_done(self.resource_instance)
        self.logger.info("Update task is done")
        await self.change_entity_status()
        await self.clean_workspace()

    async def destroy_state(self):
        make_in_progress(self.resource_instance)
        await self.change_entity_status(event_type=ModelActions.DESTROY)
        await self.init_provision_tool()
        await self.destroy()
        make_done(self.resource_instance)
        self.logger.info("Destroy task is done")
        await self.change_entity_status()
        await self.clean_workspace()

    async def dry_run(self):
        # dry run should not change the state of the resource
        if hasattr(self.logger, "add_dry_run"):
            self.logger.add_dry_run()
        else:
            self.logger.info("Run dry-run")

        if self.action == ModelActions.DRYRUN_WITH_TEMP_STATE and self.resource_temp_state_dto:
            self.logger.warning("Dry run with temporary state, the state will not be saved")

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
                await self.tf_client.dry_run(self.resource_instance.state == ModelState.DESTROY)
                await self.clean_workspace()
        except Exception as e:
            await self.clean_workspace()
            raise ExitWithoutSave(e) from e

    async def create_makefile(self):
        assert self.workspace_path is not None, "Workspace path is not defined"
        async with aiofiles.open(os.path.join(self.workspace_path, "Makefile"), "w") as f:
            _ = await f.write(
                "init:\n\t{}\nplan:\n\t{}\napply:\n\t{}\ndestroy:\n\t{}\n".format(
                    "tofu init -force-copy -upgrade -reconfigure -backend-config=backend.tfvars",
                    "tofu plan",
                    "tofu apply",
                    "tofu destroy",
                )
            )

    async def debug(self):
        await self.init_workspace()
        await self.init_provision_tool()
        await self.create_makefile()

        _ = shutil.make_archive(f"/tmp/{self.resource_instance.name.lower()}", "zip", self.workspace_path)
        return f"/tmp/{self.resource_instance.name.lower()}.zip"
