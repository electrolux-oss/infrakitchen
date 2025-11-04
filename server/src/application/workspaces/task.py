import logging
import tempfile
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from application.resources.task import ResourceTask
from application.workspaces.model import Workspace, WorkspaceDTO
from application.workspaces.schema import WorkspaceResponse
from core.adapters.provider_adapters import IntegrationProvider
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.tasks.handler import TaskHandler
from core.tools.git_client import GitClient
from core.utils.event_sender import EventSender

from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, EntityExistsError
from core.users.model import UserDTO

from .crud import WorkspaceCRUD
from .functions import copy_resource_code, delete_resource_code


logger = logging.getLogger(__name__)


class WorkspaceTask:
    def __init__(
        self,
        session: AsyncSession,
        crud_workspace: WorkspaceCRUD,
        resource_task_controller: ResourceTask,
        workspace_instance: Workspace,
        task_handler: TaskHandler,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
        workspace_root: str | None = None,
    ) -> None:
        self.session: AsyncSession = session
        self.crud_workspace: WorkspaceCRUD = crud_workspace
        self.event_sender: EventSender = event_sender
        self.logger: EntityLogger = logger
        self.resource_task_controller: ResourceTask = resource_task_controller
        self.workspace_instance: Workspace = workspace_instance
        self.user: UserDTO = user
        self.workspace_root: str = workspace_root or tempfile.mkdtemp()
        self.task_handler: TaskHandler = task_handler
        self.action: ModelActions = action

        self.git_client: GitClient | None = None
        self.git_api: Any | None = None
        self.integration_provider: IntegrationProvider | None = None

    # workflow states
    async def start_pipeline(self):
        """Default pipeline"""
        self.logger.debug(
            f"Starting pipeline for {self.workspace_instance} {self.workspace_instance.id} with action {self.action}"
        )
        self.logger.info(f"Starting pipeline with action {self.action}")

        if hasattr(self.logger, "add_log_header"):
            if self.user:
                self.logger.add_log_header(f"User: {self.user.identifier} Action: {self.action}")

        match self.action:
            case ModelActions.CREATE | ModelActions.UPDATE:
                await self.create_state()
            case ModelActions.RECREATE:
                await self.recreate_state()
            case ModelActions.APPROVE:
                await self.approve_state()
            case ModelActions.REJECT:
                await self.reject_state()
            case ModelActions.DESTROY:
                await self.destroy_state()
            case _:
                raise CannotProceed(f"Action {self.action} is not supported for workspace")

    async def init_integration_provider(self):
        """Initialize integration provider for the workspace"""
        if not self.integration_provider:
            self.logger.info("Initializing integration provider")
            workspace = WorkspaceDTO.model_validate(self.workspace_instance)

            if not workspace.integration:
                raise CannotProceed("Integration not found for workspace")

            provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(
                workspace.workspace_provider
            )
            if not provider_adapter:
                raise CannotProceed(f"Provider {workspace.workspace_provider} is not supported")
            self.integration_provider = provider_adapter(
                **{"logger": self.logger, "configuration": workspace.integration.configuration}
            )
            self.integration_provider.workspace_root = self.workspace_root
            await self.integration_provider.authenticate()

    async def evaluate_git_client(self):
        """Get Git client for the workspace"""
        self.logger.info("Evaluating Git client for the workspace")
        if not self.integration_provider:
            raise CannotProceed("Integration provider is not initialized")

        if self.git_client:
            return

        workspace = WorkspaceDTO.model_validate(self.workspace_instance)

        # Determine the Git URL based on the integration type
        integration_type = workspace.integration.integration_provider
        if "ssh" in integration_type.lower():
            git_url = workspace.configuration.ssh_url
        else:
            git_url = workspace.configuration.https_url

        try:
            self.git_client = await self.integration_provider.get_git_client(
                git_url=str(git_url),
                workspace_root=self.workspace_root,
                repo_name=workspace.name,
            )
        except NotImplementedError:
            self.logger.warning("Git client is not implemented for this provider")
            self.git_client = None

    async def evaluate_api_client(self):
        """Get API client for the workspace"""
        self.logger.info("Evaluating API client for the workspace")
        if not self.integration_provider:
            raise CannotProceed("Integration provider is not initialized")

        if self.git_api:
            return

        try:
            self.git_api = await self.integration_provider.get_api_client()
        except NotImplementedError:
            self.logger.warning("Git API client is not implemented for this provider")
            self.git_api = None

    async def init_workspace(self):
        self.logger.info(f"Init workspace at {self.workspace_root}")

        # overwrite workspace root with resource task controller root
        self.workspace_root = self.resource_task_controller.workspace_root

    # change entity state depends on task state
    def make_failed(self) -> None:
        self.workspace_instance.status = ModelStatus.ERROR

    def make_retry(self, retry: int, max_retries: int):
        if self.workspace_instance.status == ModelStatus.IN_PROGRESS:
            self.workspace_instance.status = ModelStatus.ERROR

    # sync source code with workspace and create PR
    async def change_state(self, new_state: ModelStatus, event_type: str = ModelActions.SYNC) -> None:
        self.workspace_instance.status = new_state
        if hasattr(self.logger, "save_log"):
            await self.logger.save_log()

        await self.task_handler.update_task(status=self.workspace_instance.status)
        await self.session.commit()
        await self.crud_workspace.refresh(self.workspace_instance)
        response_model = WorkspaceResponse.model_validate(self.workspace_instance)
        await self.event_sender.send_event(response_model, event_type)

    async def recreate_state(self):
        await self.change_state(ModelStatus.IN_PROGRESS)
        await self.sync_source_code()
        await self.approve()
        self.logger.info("Sync task is done")
        await self.change_state(ModelStatus.DONE)

    async def create_state(self):
        await self.change_state(ModelStatus.IN_PROGRESS)
        await self.sync_source_code()
        self.logger.info("Sync task is done")
        await self.change_state(ModelStatus.DONE)

    async def destroy_state(self):
        await self.change_state(ModelStatus.IN_PROGRESS)
        await self.delete_source_code()
        self.logger.info("Delete task is done")
        await self.change_state(ModelStatus.DONE)

    async def delete_source_code(self) -> None:
        self.logger.info(f"Syncing workspace {self.workspace_instance.id} to git repository")

        await self.init_workspace()
        await self.init_integration_provider()
        await self.evaluate_git_client()
        await self.evaluate_api_client()

        assert self.git_client, "Git client is not initialized"
        # get resource source code

        await self.git_client.clone()
        workspace_pydantic = WorkspaceDTO.model_validate(self.workspace_instance)
        resource_instance = self.resource_task_controller.resource_instance
        destination_path = f"{self.git_client.destination_dir}/{resource_instance.template.template}/{resource_instance.name.replace(' ', '_').lower()}"  # noqa: E501
        new_branch = self.get_new_branch_name()

        await self.git_client.checkout_to_new_branch(
            new_branch,
            workspace_pydantic.configuration.default_branch,
        )
        self.logger.info(f"Syncing resource code to {destination_path}")

        await delete_resource_code(destination_path, logger=self.logger)

        commit_message = f"Delete resource {resource_instance.name}. Initiated by {self.user.identifier}"

        await self.git_client.add_changes()
        await self.git_client.commit_changes(
            commit_message, user_email=self.user.email, user_name=self.user.display_name or self.user.identifier
        )
        await self.git_client.push(new_branch, force=True)
        if self.git_api:
            self.logger.info("Creating pull request for the synced changes")
            try:
                await self.git_api.create_pull_request(
                    org=workspace_pydantic.configuration.organization,
                    repo=workspace_pydantic.name,
                    title=f"Sync resource {resource_instance.name}",
                    body="This PR is created automatically to delete resource",
                    head=new_branch,
                    base=workspace_pydantic.configuration.default_branch,
                )
            except ValueError as e:
                self.logger.warning(f"Failed to create pull request: {e}")
            except EntityExistsError:
                self.logger.warning("Pull request already exists, skipping creation")
        else:
            self.logger.warning("Git API client is not initialized, cannot create pull request")

    def get_new_branch_name(self) -> str:
        resource_instance = self.resource_task_controller.resource_instance
        new_branch = resource_instance.name.replace(" ", "_").lower()
        if resource_instance.state in [ModelState.DESTROY, ModelState.DESTROYED]:
            new_branch = f"delete_{new_branch}"
        elif resource_instance.state in [ModelState.PROVISION, ModelState.PROVISIONED]:
            new_branch = f"update_{new_branch}"
        else:
            raise CannotProceed(f"Resource has invalid state {resource_instance.state}")

        return new_branch

    async def sync_source_code(self) -> None:
        self.logger.info(f"Syncing workspace {self.workspace_instance.id} to git repository")

        await self.init_workspace()
        await self.init_integration_provider()
        await self.evaluate_git_client()
        await self.evaluate_api_client()

        assert self.git_client, "Git client is not initialized"
        # get resource source code
        await self.resource_task_controller.init_workspace()

        await self.git_client.clone()
        await self.resource_task_controller.init_provision_tool()
        await self.resource_task_controller.create_makefile()
        workspace_pydantic = WorkspaceDTO.model_validate(self.workspace_instance)
        resource_workspace = self.resource_task_controller.workspace_path
        assert resource_workspace, "Resource workspace path is not set"
        resource_instance = self.resource_task_controller.resource_instance
        destination_path = f"{self.git_client.destination_dir}/{resource_instance.template.template}/{resource_instance.name.replace(' ', '_').lower()}"  # noqa: E501
        new_branch = self.get_new_branch_name()

        await self.git_client.checkout_to_new_branch(
            new_branch,
            workspace_pydantic.configuration.default_branch,
        )
        self.logger.info(f"Syncing resource code to {destination_path}")

        await copy_resource_code(resource_workspace, destination_path, logger=self.logger)

        commit_message = f"Sync resource {resource_instance.name}. Created by {self.user.identifier}"

        await self.git_client.add_changes()
        await self.git_client.commit_changes(
            commit_message, user_email=self.user.email, user_name=self.user.display_name or self.user.identifier
        )
        await self.git_client.push(new_branch, force=True)
        if self.git_api:
            self.logger.info("Creating pull request for the synced changes")
            try:
                await self.git_api.create_pull_request(
                    org=workspace_pydantic.configuration.organization,
                    repo=workspace_pydantic.name,
                    title=f"Sync resource {resource_instance.name}",
                    body="This PR is created automatically to sync resource changes",
                    head=new_branch,
                    base=workspace_pydantic.configuration.default_branch,
                )
            except ValueError as e:
                self.logger.warning(f"Failed to create pull request: {e}")
            except EntityExistsError:
                self.logger.warning("Pull request already exists, skipping creation")
        else:
            self.logger.warning("Git API client is not initialized, cannot create pull request")

    # approve entity merges branch to main
    async def approve_state(self):
        self.logger.info(f"Approving workspace {self.workspace_instance.id} changes")
        await self.change_state(ModelStatus.IN_PROGRESS, event_type=ModelActions.APPROVE)
        await self.approve()
        self.logger.info("Approve task is done")
        await self.change_state(ModelStatus.DONE)

    async def approve(self):
        await self.init_workspace()
        await self.init_integration_provider()
        await self.evaluate_api_client()
        if not self.git_api:
            self.logger.warning("Git API client is not initialized, cannot approve changes")
            return

        workspace_pydantic = WorkspaceDTO.model_validate(self.workspace_instance)
        head_branch = self.get_new_branch_name()
        pr = await self.git_api.get_pull_request(
            org=workspace_pydantic.configuration.organization,
            repo=self.workspace_instance.name,
            base=workspace_pydantic.configuration.default_branch,
            head=head_branch,
        )

        if not pr:
            self.logger.warning(f"No pull request found for branch {head_branch}")
            return

        merged = await self.git_api.merge_pull_request(
            org=workspace_pydantic.configuration.organization,
            repo=self.workspace_instance.name,
            pr_object=pr,
            commit_message="Approved changes from resource sync",
        )
        if merged:
            self.logger.info("Pull request merged successfully")
        else:
            self.logger.error("Failed to merge pull request")
            raise CannotProceed("Failed to merge pull request")

    # reject entity updates and close pull request
    async def reject_state(self):
        self.logger.info(f"Rejecting workspace {self.workspace_instance.id} changes")
        await self.change_state(ModelStatus.IN_PROGRESS, event_type=ModelActions.REJECT)
        await self.reject()
        self.logger.info("Reject task is done")
        await self.change_state(ModelStatus.DONE, event_type=ModelActions.REJECT)

    async def reject(self):
        await self.init_workspace()
        await self.init_integration_provider()
        await self.evaluate_api_client()
        if not self.git_api:
            self.logger.warning("Git API client is not initialized, cannot reject changes")
            return

        workspace_pydantic = WorkspaceDTO.model_validate(self.workspace_instance)
        head_branch = self.get_new_branch_name()
        pr = await self.git_api.get_pull_request(
            org=workspace_pydantic.configuration.organization,
            repo=self.workspace_instance.name,
            base=workspace_pydantic.configuration.default_branch,
            head=head_branch,
        )

        if not pr:
            self.logger.warning(f"No pull request found for branch {head_branch}")
            return

        closed = await self.git_api.close_pull_request(
            org=workspace_pydantic.configuration.organization,
            repo=self.workspace_instance.name,
            pr_object=pr,
        )
        if closed:
            self.logger.info("Pull request closed successfully")
        else:
            self.logger.error("Failed to close pull request")
            raise CannotProceed("Failed to close pull request")
