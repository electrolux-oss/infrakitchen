import logging
from typing import Any
from uuid import UUID

from application.integrations.model import Integration
from application.source_codes.crud import SourceCodeCRUD
from application.source_codes.iac import IacModule
from application.source_codes.model import SourceCode
from application.storages.model import Storage
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityExistsError, EntityNotFound, EntityWrongState
from core.tools.model import Tool
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import IacCRUD
from .functions import environment_regions, find_environment
from .model import IacEnvironmentConfig, IacRun
from .schema import IacEnvironmentConfigCreate, IacEnvironmentConfigUpdate, IacPlanCreate

logger = logging.getLogger(__name__)

PLAN_ACTION = "plan"


class IacService:
    """Environment settings and runs of the modules of IaC repositories."""

    def __init__(
        self,
        crud: IacCRUD,
        source_code_crud: SourceCodeCRUD,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud: IacCRUD = crud
        self.source_code_crud: SourceCodeCRUD = source_code_crud
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def _get_iac_source_code(self, source_code_id: str | UUID) -> SourceCode:
        source_code = await self.source_code_crud.get_by_id(source_code_id)
        if source_code is None:
            raise EntityNotFound("Source code not found")
        if source_code.repository_type != "iac":
            raise ValueError("Only Infrastructure as Code repositories have modules to run")
        return source_code

    # Environment settings

    async def get_environment_configs(self, source_code_id: str | UUID) -> list[IacEnvironmentConfig]:
        return await self.crud.get_environment_configs(source_code_id)

    async def _get_cloud_integrations(self, integration_ids: list[UUID]) -> list[Integration]:
        # An environment is one cloud account.
        if len(set(integration_ids)) > 1:
            raise ValueError("An environment can only have one cloud integration")
        integrations = await self.crud.get_integrations(integration_ids)
        if len(integrations) != len(set(integration_ids)):
            raise EntityNotFound("Integration not found")
        for integration in integrations:
            if integration.integration_type != "cloud":
                raise ValueError(f"Integration {integration.name} is not a cloud integration")
        return integrations

    async def _assert_exists(self, model: type[Storage] | type[Tool], entity_id: UUID, label: str) -> None:
        if await self.crud.session.get(model, entity_id) is None:
            raise EntityNotFound(f"{label} not found")

    async def create_environment_config(
        self, source_code_id: str | UUID, body: IacEnvironmentConfigCreate, requester: UserDTO
    ) -> IacEnvironmentConfig:
        source_code = await self._get_iac_source_code(source_code_id)
        name = body.name.strip()
        if await self.crud.get_environment_config_by_name(source_code.id, name):
            raise EntityExistsError(f"Environment {name} is already configured")
        if body.storage_id:
            await self._assert_exists(Storage, body.storage_id, "Storage")
        if body.tool_id:
            await self._assert_exists(Tool, body.tool_id, "Tool")

        config = await self.crud.create_environment_config(
            {
                "source_code_id": source_code.id,
                "name": name,
                "integrations": await self._get_cloud_integrations(body.integration_ids),
                "storage_id": body.storage_id,
                "state_path_template": body.state_path_template,
                "tool_id": body.tool_id,
                "regions": body.regions,
                "region_variable": body.region_variable or None,
                "variables": body.variables,
                "region_variables": body.region_variables,
                "created_by": requester.id,
            }
        )
        await self.audit_log_handler.create_log(
            source_code.id, requester.id, ModelActions.UPDATE, action_metadata={"environment": name}
        )
        await self.crud.refresh(config)
        return config

    async def update_environment_config(
        self, config_id: str | UUID, body: IacEnvironmentConfigUpdate, requester: UserDTO
    ) -> IacEnvironmentConfig:
        config = await self.crud.get_environment_config(config_id)
        if config is None:
            raise EntityNotFound("Environment not found")

        if body.integration_ids is not None:
            config.integrations = await self._get_cloud_integrations(body.integration_ids)
        if body.clear_storage:
            config.storage_id = None
        elif body.storage_id:
            await self._assert_exists(Storage, body.storage_id, "Storage")
            config.storage_id = body.storage_id
        if body.clear_tool:
            config.tool_id = None
        elif body.tool_id:
            await self._assert_exists(Tool, body.tool_id, "Tool")
            config.tool_id = body.tool_id
        if body.state_path_template is not None:
            config.state_path_template = body.state_path_template
        if body.regions is not None:
            config.regions = body.regions
        if body.region_variable is not None:
            config.region_variable = body.region_variable or None
        if body.variables is not None:
            config.variables = body.variables
        if body.region_variables is not None:
            config.region_variables = body.region_variables

        await self.audit_log_handler.create_log(
            config.source_code_id, requester.id, ModelActions.UPDATE, action_metadata={"environment": config.name}
        )
        await self.crud.session.flush()
        await self.crud.refresh(config)
        return config

    async def delete_environment_config(self, config_id: str | UUID, requester: UserDTO) -> None:
        config = await self.crud.get_environment_config(config_id)
        if config is None:
            raise EntityNotFound("Environment not found")
        await self.audit_log_handler.create_log(
            config.source_code_id, requester.id, ModelActions.DELETE, action_metadata={"environment": config.name}
        )
        await self.crud.delete_environment_config(config)

    # Runs

    @staticmethod
    def _find_module(source_code: SourceCode, module_path: str) -> IacModule:
        for stored in source_code.iac_modules or []:
            module = IacModule.model_validate(stored)
            if module.path == module_path:
                return module
        raise EntityNotFound(f"Module {module_path or '/'} was not found at the last sync")

    async def plan(self, source_code_id: str | UUID, body: IacPlanCreate, requester: UserDTO) -> IacRun:
        """Queue a plan of a module in an environment."""
        source_code = await self._get_iac_source_code(source_code_id)
        if source_code.status in (ModelStatus.DISABLED, ModelStatus.IN_PROGRESS, ModelStatus.QUEUED):
            raise EntityWrongState(f"Source code has wrong status for running {source_code.status}")

        module = self._find_module(source_code, body.module_path)
        environment = find_environment(module, body.environment_name)
        if environment is None:
            raise EntityNotFound(f"Module {module.name} has no environment {body.environment_name}")

        config = await self.crud.get_environment_config_by_name(source_code.id, body.environment_name)
        if config is None:
            raise EntityWrongState(f"Configure the {body.environment_name} environment before running it")

        regions = [region.name for region in environment_regions(environment, config.regions)]
        if regions and body.region not in regions:
            raise ValueError(f"Pick one of the regions of {body.environment_name}: {', '.join(regions)}")
        if not regions and body.region is not None:
            raise ValueError(f"{body.environment_name} is not deployed to regions")

        stack = " ".join(filter(None, [body.environment_name, body.region]))
        if await self.crud.get_active_run(source_code.id, body.module_path, body.environment_name, body.region):
            raise EntityWrongState(f"{module.name} already has a run in progress in {stack}")

        ref = body.ref
        if body.sha is None and ref is None:
            ref = source_code.default_branch
            if ref is None:
                raise EntityWrongState("Sync the repository before running its modules")

        run = await self.crud.create_run(
            {
                "source_code_id": source_code.id,
                "module_path": body.module_path,
                "environment_name": body.environment_name,
                "region": body.region,
                "action": PLAN_ACTION,
                "ref": ref,
                "sha": body.sha,
                "status": ModelStatus.QUEUED,
                "created_by": requester.id,
            }
        )
        await self.audit_log_handler.create_log(
            source_code.id,
            requester.id,
            ModelActions.DRYRUN,
            action_metadata={
                "run_id": str(run.id),
                "module": body.module_path,
                "environment": body.environment_name,
                "region": body.region or "",
                "ref": ref or "",
                "sha": body.sha or "",
            },
        )
        await self.event_sender.send_task(
            run.id,
            requester=requester,
            trace_id=self.audit_log_handler.trace_id,
            audit_log_id=self.audit_log_handler.audit_log_id,
            action=ModelActions.DRYRUN,
        )
        await self.crud.refresh(run)
        return run

    async def get_run(self, run_id: str | UUID) -> IacRun | None:
        return await self.crud.get_run(run_id)

    async def get_runs(self, source_code_id: str | UUID, **kwargs: Any) -> list[IacRun]:
        return await self.crud.get_runs(source_code_id, **kwargs)

    async def count_runs(self, source_code_id: str | UUID, **kwargs: Any) -> int:
        return await self.crud.count_runs(source_code_id, **kwargs)

    async def get_latest_runs(self, source_code_id: str | UUID) -> list[IacRun]:
        return await self.crud.get_latest_runs(source_code_id)
