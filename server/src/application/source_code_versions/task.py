import difflib
import logging

import os
import tempfile
import re

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import IntegrationDTO
from application.source_code_versions.model import SourceCodeVersion
from application.source_code_versions.crud import SourceCodeVersionCRUD
from application.source_code_versions.schema import (
    SourceCodeVersionResponse,
    SourceConfigCreate,
    SourceOutputConfigCreate,
)
from application.source_code_versions.service import SourceCodeVersionService
from application.source_codes.model import SourceCodeDTO
from core.adapters.provider_adapters import IntegrationProvider
from core.constants.model import ModelActions, ModelStatus
from core.tasks.handler import TaskHandler
from core.tools.git_client import GitClient
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed, ExitWithoutSave

from ..source_code_versions import VariableModel, OutputVariableModel
from ..tools import OtfProvider

logger = logging.getLogger(__name__)

_FILE_DIVIDER_PATTERN = re.compile(r"^#\s*-{2,}\s*FILE:\s*(.+?)\s*-{2,}\s*$")


def _parse_snapshot_files(snapshot: str) -> dict[str, str]:
    """Parse a code snapshot string into a dict of {filename: content}."""
    files: dict[str, str] = {}
    current_name: str | None = None
    current_lines: list[str] = []

    for line in snapshot.split("\n"):
        match = _FILE_DIVIDER_PATTERN.match(line)
        if match:
            if current_name is not None:
                files[current_name] = "\n".join(current_lines).strip()
            current_name = match.group(1).strip()
            current_lines = []
        elif current_name is not None:
            current_lines.append(line)

    if current_name is not None:
        files[current_name] = "\n".join(current_lines).strip()

    return files


class SourceCodeVersionTask:
    def __init__(
        self,
        session: AsyncSession,
        crud_source_code_version: SourceCodeVersionCRUD,
        source_code_version_service: SourceCodeVersionService,
        source_code_version_instance: SourceCodeVersion,
        source_code_instance: SourceCodeDTO,
        task_handler: TaskHandler,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
        workspace_root: str | None = None,
    ) -> None:
        self.session: AsyncSession = session
        self.crud_source_code_version: SourceCodeVersionCRUD = crud_source_code_version
        self.source_code_version_service: SourceCodeVersionService = source_code_version_service
        self.event_sender: EventSender = event_sender
        self.logger: EntityLogger = logger
        self.source_code_version_instance: SourceCodeVersion = source_code_version_instance
        self.source_code_instance: SourceCodeDTO = source_code_instance
        self.user: UserDTO = user
        self.workspace_root: str = workspace_root or tempfile.mkdtemp()
        self.task_handler: TaskHandler = task_handler
        self.action: ModelActions = action
        self.git_client: GitClient | None = None
        self.environment_variables: dict[str, str] = {}

    # workflow states
    async def start_pipeline(self):
        self.logger.make_expired()
        self.logger.debug(
            f"Starting pipeline for {self.source_code_version_instance} {self.source_code_version_instance.id} with action {self.action}"  # noqa
        )

        if hasattr(self.logger, "add_log_header"):
            if self.user:
                self.logger.add_log_header(f"User: {self.user.identifier} Action: {self.action}")

        self.logger.info(f"Running on worker: {os.uname().nodename}")

        match self.action:
            case ModelActions.SYNC:
                self.logger.info(f"Starting pipeline with action {self.action}")
                await self.sync_source_code_version()
            case _:
                raise CannotProceed(f"Unknown action: {self.action}")

    async def generate_configs_and_outputs(self, variables: list[VariableModel], outputs: list[OutputVariableModel]):
        """Generate configs and outputs for the source code version"""
        self.logger.info(f"Generating configs for {self.source_code_version_instance.id}")

        configs: list[SourceConfigCreate] = []
        for idx, v in enumerate(variables):
            config = SourceConfigCreate(
                index=idx,
                source_code_version_id=self.source_code_version_instance.id,
                name=v.name,
                description=v.description,
                type=v.type,
                required=True if v.default is None else False,
                default=v.default,
                sensitive=v.sensitive,
                frozen=False,
                unique=False,
                options=[],
            )
            configs.append(config)
        _ = await self.source_code_version_service.create_configs(configs)

        foroutputs: list[SourceOutputConfigCreate] = []
        for idx, o in enumerate(outputs):
            output = SourceOutputConfigCreate(
                index=idx,
                source_code_version_id=self.source_code_version_instance.id,
                name=o.name,
                description=o.description,
            )
            foroutputs.append(output)
        _ = await self.source_code_version_service.create_output_configs(foroutputs)

    async def init_workspace(self):
        self.logger.info(f"Init workspace at {self.workspace_root}")

        # Authentication is not required for public repositories
        if not self.source_code_instance.integration:
            provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("git_public")
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
        self.git_client = await provider_adapter_instance.get_git_client(
            git_url=self.source_code_instance.source_code_url,
            workspace_root=self.workspace_root,
            repo_name="source_code_repo",
        )

    async def get_source_code_version_data(self):
        if not self.git_client:
            raise CannotProceed("Git client is not initialized. Cannot fetch source code data.")

        if not self.source_code_instance:
            raise CannotProceed("SourceCode instance not found")

        branch = (
            self.source_code_version_instance.source_code_version
            or self.source_code_version_instance.source_code_branch
        )

        if not branch:
            raise CannotProceed("Branch is not specified for the source code version")

        await self.git_client.clone_branch(branch=branch)
        code_language = self.source_code_instance.source_code_language

        if code_language == "opentofu":
            destination_dir = (
                f"{self.git_client.destination_dir}/{self.source_code_version_instance.source_code_folder}"
                if self.source_code_version_instance.source_code_folder
                else self.git_client.destination_dir
            )
            self.logger.info(f"Starting file parsing in directory: {destination_dir}")

            main_otf = OtfProvider(destination_dir)
            tf_data = await main_otf.parse_tf_directory_to_json()

            variables = main_otf.remap_variable_types(main_otf.list_to_dict(tf_data.get("variable", [])))
            vars = [VariableModel.get_from_named_dict(variables, v) for v in variables]
            self.source_code_version_instance.variables = [v.model_dump() for v in vars]

            outputs = main_otf.list_to_dict(tf_data.get("output", []))
            outpts = [OutputVariableModel.get_from_named_dict(outputs, o) for o in outputs]
            self.source_code_version_instance.outputs = [o.model_dump() for o in outpts]

            snapshot_otf = OtfProvider(
                destination_dir,
                repo_root=self.git_client.destination_dir,
                repo_url=self.source_code_instance.source_code_url,
                source_code_ref=branch,
                git_client=self.git_client,
                follow_modules=True,
            )
            await snapshot_otf.read_files_to_string()

            if not self.source_code_version_instance.code_snapshot:
                self.source_code_version_instance.code_snapshot = snapshot_otf.tf_string_data
            else:
                self._log_code_snapshot_drift(
                    self.source_code_version_instance.code_snapshot, snapshot_otf.tf_string_data
                )
                self.source_code_version_instance.code_snapshot = snapshot_otf.tf_string_data
            self.logger.info(f"Variables found: {len(self.source_code_version_instance.variables)}")
            self.logger.info(f"Outputs found: {len(self.source_code_version_instance.outputs)}")

            if not await self.source_code_version_service.get_configs_by_scv_id(self.source_code_version_instance.id):
                self.logger.info("Variable configs are not found, generating default ones based on the variables")
                await self.generate_configs_and_outputs(vars, outpts)
            await self.session.commit()
        await self.git_client.delete_workspace()

    def _log_code_snapshot_drift(self, old_snapshot: str, new_snapshot: str) -> None:
        old_files = _parse_snapshot_files(old_snapshot)
        new_files = _parse_snapshot_files(new_snapshot)
        all_filenames = sorted(set(old_files) | set(new_files))

        for filename in all_filenames:
            if filename not in old_files:
                self.logger.warning(f"[DRIFT] New file added: {filename}")
            elif filename not in new_files:
                self.logger.warning(f"[DRIFT] File removed: {filename}")
            elif old_files[filename] != new_files[filename]:
                self.logger.warning(f"[DRIFT] File changed: {filename}")
                diff_lines = difflib.unified_diff(
                    old_files[filename].splitlines(),
                    new_files[filename].splitlines(),
                    fromfile=f"a/{filename}",
                    tofile=f"b/{filename}",
                    lineterm="",
                )
                for line in diff_lines:
                    self.logger.warning(line)

    # change entity state depends on task state
    async def change_entity_status(self, new_state: ModelStatus) -> None:
        self.source_code_version_instance.status = new_state
        if hasattr(self.logger, "save_log"):
            await self.logger.save_log()

        await self.task_handler.update_task(status=self.source_code_version_instance.status)
        await self.session.commit()
        await self.crud_source_code_version.refresh(self.source_code_version_instance)
        response_model = SourceCodeVersionResponse.model_validate(self.source_code_version_instance)
        await self.event_sender.send_event(response_model, ModelActions.SYNC)
        await self.event_sender.flush()

    async def make_failed(self) -> None:
        await self.change_entity_status(ModelStatus.ERROR)

    async def make_retry(self, retry: int, max_retries: int):
        if self.source_code_version_instance.status == ModelStatus.IN_PROGRESS:
            await self.change_entity_status(ModelStatus.ERROR)

    async def sync_source_code_version(self):
        self.logger.debug(
            f"Syncing SourceCodeVersion ID: {self.source_code_version_instance.id} {self.source_code_version_instance.status}"  # noqa
        )
        if self.source_code_version_instance.status in [ModelStatus.ERROR, ModelStatus.DONE, ModelStatus.READY]:
            await self.init_workspace()
            await self.sync_state()
        else:
            raise ExitWithoutSave(
                f"Entity cannot be synced, has wrong status {self.source_code_version_instance.status}"
            )

    async def sync_state(self):
        await self.change_entity_status(ModelStatus.IN_PROGRESS)
        await self.get_source_code_version_data()
        self.logger.info("Sync task is done")
        await self.change_entity_status(ModelStatus.DONE)
