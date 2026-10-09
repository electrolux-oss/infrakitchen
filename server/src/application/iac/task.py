import logging
import os
import shutil
import tempfile
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import IntegrationDTO
from application.source_codes.iac import IacEnvironment, IacModule, IacRegion
from application.source_codes.model import SourceCode
from application.storages.functions import get_tf_storage_config, get_tf_storage_environment, get_tf_workspace
from application.tools import OtfClient, OtfProvider
from application.tools.cloud_api_manager import CloudApiManager
from core.adapters.provider_adapters import IntegrationProvider
from core.constants.model import ModelActions, ModelStatus
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, ExitWithoutSave
from core.tasks.service import TaskEntityService
from core.tools.functions import resolve_tool_to_run
from core.tools.git_client import GitClient
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import IacCRUD
from .functions import environment_regions, find_environment, parse_plan_summary, run_variables, state_path
from .model import IacEnvironmentConfig, IacRun
from .schema import IacRunResponse

logger = logging.getLogger(__name__)


class IacRunTask:
    """Runs one IacRun on the worker: checks out its commit and plans the module in its environment."""

    def __init__(
        self,
        session: AsyncSession,
        crud: IacCRUD,
        run: IacRun,
        source_code: SourceCode,
        environment_config: IacEnvironmentConfig | None,
        task_service: TaskEntityService,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
        workspace_root: str | None = None,
    ) -> None:
        self.session: AsyncSession = session
        self.crud: IacCRUD = crud
        self.run: IacRun = run
        self.source_code: SourceCode = source_code
        self.environment_config: IacEnvironmentConfig | None = environment_config
        self.task_service: TaskEntityService = task_service
        self.logger: EntityLogger = logger
        self.user: UserDTO = user
        self.event_sender: EventSender = event_sender
        self.action: ModelActions = action
        self.workspace_root: str = workspace_root or tempfile.mkdtemp()
        self.environment_variables: dict[str, str] = {}

    async def start_pipeline(self) -> None:
        self.logger.make_expired()
        if hasattr(self.logger, "add_log_header") and self.user:
            self.logger.add_log_header(f"User: {self.user.identifier} Action: {self.run.action}")
        self.logger.info(f"Running on worker: {os.uname().nodename}")

        try:
            match self.action:
                case ModelActions.DRYRUN:
                    await self.plan()
                case _:
                    raise CannotProceed(f"Unknown action: {self.action}")
        finally:
            shutil.rmtree(self.workspace_root, ignore_errors=True)

    async def change_run_status(self, new_status: ModelStatus) -> None:
        self.run.status = new_status
        if new_status == ModelStatus.IN_PROGRESS:
            self.run.started_at = datetime.now(UTC)
        elif new_status in (ModelStatus.DONE, ModelStatus.ERROR):
            self.run.finished_at = datetime.now(UTC)
        if hasattr(self.logger, "save_log"):
            await self.logger.save_log()

        await self.task_service.update_task(
            entity_id=self.run.id, entity_name="iac_run", requester=self.user, status=new_status
        )
        await self.session.commit()
        await self.crud.refresh(self.run)
        await self.event_sender.send_event(IacRunResponse.model_validate(self.run), self.action)
        await self.event_sender.flush()

    async def make_failed(self) -> None:
        await self.change_run_status(ModelStatus.ERROR)

    async def make_retry(self, retry: int, max_retries: int) -> None:
        if self.run.status == ModelStatus.IN_PROGRESS:
            await self.change_run_status(ModelStatus.ERROR)

    def _environment(self) -> tuple[IacModule, IacEnvironment]:
        """The module and the environment of the run, as discovered at the last sync."""
        for stored in self.source_code.iac_modules or []:
            module = IacModule.model_validate(stored)
            if module.path != self.run.module_path:
                continue
            environment = find_environment(module, self.run.environment_name)
            if environment is not None:
                return module, environment
        raise CannotProceed(
            f"Module {self.run.module_path or '/'} has no environment {self.run.environment_name} at the last sync"
        )

    def _region(self, environment: IacEnvironment, config: IacEnvironmentConfig) -> IacRegion | None:
        """Where the run is deployed to, None for an environment without regions."""
        regions = environment_regions(environment, config.regions)
        if not regions:
            if self.run.region is not None:
                raise CannotProceed(f"{environment.name} is not deployed to regions")
            return None
        region = next((region for region in regions if region.name == self.run.region), None)
        if region is None:
            raise CannotProceed(f"{environment.name} is not deployed to {self.run.region}")
        return region

    async def init_git_client(self) -> GitClient:
        integration = self.source_code.integration
        if integration is None:
            # Authentication is not required for public repositories
            adapter = IntegrationProvider.adapters.get("git_public")
            if not adapter:
                raise CannotProceed("Public provider is not supported")
            provider: IntegrationProvider = adapter(**{"logger": self.logger})
        else:
            integration_dto = IntegrationDTO.model_validate(integration)
            adapter = IntegrationProvider.adapters.get(integration_dto.integration_provider)
            if not adapter:
                raise CannotProceed(f"Provider {integration_dto.integration_provider} is not supported")
            self.logger.info(f"Authenticating with provider {integration_dto.integration_provider}")
            provider = adapter(**{"logger": self.logger, "configuration": integration_dto.configuration})

        provider.workspace_root = self.workspace_root
        await provider.authenticate()
        # Module sources in the same repository or organisation need the same credentials.
        self.environment_variables.update(provider.environment_variables)
        git_client = await provider.get_git_client(
            git_url=self.source_code.source_code_url, workspace_root=self.workspace_root, repo_name="repo"
        )
        # Never wait for an interactive credential prompt.
        git_client.environment_variables = {**git_client.environment_variables, "GIT_TERMINAL_PROMPT": "0"}
        return git_client

    async def resolve_sha(self, git_client: GitClient) -> str:
        if self.run.sha:
            return self.run.sha
        ref = self.run.ref
        if not ref:
            raise CannotProceed("Run has neither a commit nor a branch or tag")
        tag_sha = (self.source_code.git_tag_shas or {}).get(ref)
        sha = tag_sha or await git_client.get_remote_branch_head(ref)
        if sha is None:
            tags = {tag.name: tag.sha for tag in await git_client.get_remote_tags()}
            sha = tags.get(ref)
        if sha is None:
            raise CannotProceed(f"Branch or tag {ref} was not found in the repository")
        return sha

    async def plan(self) -> None:
        if self.run.status != ModelStatus.QUEUED:
            raise ExitWithoutSave(f"Run cannot be started, it has status {self.run.status}")
        await self.change_run_status(ModelStatus.IN_PROGRESS)

        config = self.environment_config
        if config is None:
            raise CannotProceed(f"Environment {self.run.environment_name} is not configured")
        module, environment = self._environment()
        region = self._region(environment, config)
        target = region or environment
        self.logger.info(f"Planning {module.name} in {environment.name}" + (f" ({region.name})" if region else ""))

        git_client = await self.init_git_client()
        sha = await self.resolve_sha(git_client)
        fallback_ref = self.run.ref or self.source_code.default_branch
        self.run.sha = await git_client.checkout_commit(sha, ref=fallback_ref)
        self.logger.info(f"Checked out {self.run.sha}" + (f" ({self.run.ref})" if self.run.ref else ""))

        repo_dir = git_client.destination_dir
        working_dir = os.path.join(repo_dir, target.working_dir)
        if not os.path.isdir(working_dir):
            raise CannotProceed(f"{target.working_dir or '/'} does not exist at {self.run.sha[:7]}")

        cloud_api_manager = CloudApiManager(
            model_instance=self.run, logger=self.logger, workspace_root=self.workspace_root
        )
        for integration in config.integrations:
            await cloud_api_manager.get_cloud_credentials(
                IntegrationDTO.model_validate(integration), self.environment_variables
            )
        self.environment_variables.update(
            run_variables(config.variables, config.region_variables, region.name if region else None)
        )
        if region is not None:
            # Set after the credentials, so the region of the run wins over the integration's.
            self.environment_variables["AWS_REGION"] = region.name
            self.environment_variables["AWS_DEFAULT_REGION"] = region.name
            if config.region_variable:
                self.environment_variables[f"TF_VAR_{config.region_variable}"] = region.name

        tf_client = await self.init_tf_client(module, environment, region, config, working_dir)
        await tf_client.init()

        var_files = [f"-var-file={os.path.relpath(os.path.join(repo_dir, f), working_dir)}" for f in target.var_files]
        output = await tf_client.plan(["-input=false", *var_files])

        summary = parse_plan_summary(output)
        if summary is not None:
            self.run.to_add, self.run.to_change, self.run.to_destroy = summary
            self.logger.info(
                f"Plan: {summary.to_add} to add, {summary.to_change} to change, {summary.to_destroy} to destroy"
            )
        await self.change_run_status(ModelStatus.DONE)

    async def init_tf_client(
        self,
        module: IacModule,
        environment: IacEnvironment,
        region: IacRegion | None,
        config: IacEnvironmentConfig,
        working_dir: str,
    ) -> OtfClient:
        tool = await resolve_tool_to_run(self.session, config.tool_id)
        self.logger.info(f"Initiating {tool.label}...")

        otf_provider = OtfProvider(working_dir)
        tf_data = await otf_provider.parse_tf_directory_to_json()
        has_backend = "backend" in otf_provider.list_to_dict(tf_data.get("terraform", []))

        storage = config.storage
        backend_config = ""
        workspace: str | None = None
        if storage is not None:
            key = state_path(
                config.state_path_template, module.path, module.name, environment.name, region.name if region else None
            )
            self.logger.info(f"State is kept in storage {storage.name} at {key}")
            await otf_provider.setup_tf_backend(tf_data, storage.storage_provider)
            self.environment_variables.update(get_tf_storage_environment(storage))
            backend_config = get_tf_storage_config(storage, key)
            workspace = get_tf_workspace(storage, key)
        elif region is not None and region.working_dir == environment.working_dir:
            # The backend block has one fixed state, which every region would share and overwrite.
            raise CannotProceed(
                f"The regions of {environment.name} run in the same folder; "
                "set a storage so each region gets its own state"
            )
        elif has_backend:
            self.logger.info("Using the backend configured in the module")
        else:
            # A local state would be lost with the workspace after the run.
            raise CannotProceed(
                f"{environment.working_dir or '/'} has no backend block; set a storage for {environment.name}"
            )

        # Written here instead of OtfClient.init_tf_workspace, which also writes terraform.tfvars.json
        # and would overwrite a file of that name in the repository.
        with open(os.path.join(working_dir, "backend.tfvars"), "w", encoding="utf-8") as f:
            _ = f.write(backend_config)

        return OtfClient(
            working_dir,
            environment_variables=self.environment_variables,
            variables={},
            backend_storage_config=backend_config,
            logger=self.logger,
            tool_path=tool.path,
            workspace=workspace,
        )
