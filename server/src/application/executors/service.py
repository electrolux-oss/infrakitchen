import logging
from typing import Any
from uuid import UUID

from application.executors.functions import (
    build_executor_audit_snapshot,
    delete_executor_policies,
    get_executor_actions,
    get_executor_permissions,
    resolve_run_ref,
)
from application.favorites.service import FavoriteService
from application.integrations.schema import IntegrationShort
from application.integrations.service import IntegrationService
from application.executors.model import Executor, ExecutorDTO
from application.projects.crud import ProjectCRUD
from application.projects.functions import get_project_permissions, require_enabled_project
from application.source_code_versions.service import SourceCodeService
from application.storages.service import StorageService
from application.worker_templates.service import WorkerTemplateService
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.tools.service import ToolService
from core.constants import ModelStatus, ModelState
from core.constants.model import ModelActions
from core.database import FieldSpec, to_dict
from core.errors import AccessDenied, EntityNotFound, EntityWrongState
from core.logs.service import LogService
from core.notifications.service import SubscriptionService
from core.permissions.service import PermissionService
from core.revisions.handler import RevisionHandler
from core.tasks.service import TaskEntityService
from core.users.functions import require_entity_write_access
from core.users.model import UserDTO
from core.utils.entity_state_handler import (
    delete_entity,
    destroy_entity,
    execute_entity,
    recreate_entity,
)
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, is_valid_uuid, model_db_dump
from .crud import ExecutorCRUD
from .schema import (
    ExecutorCreate,
    ExecutorResponse,
    ExecutorUpdate,
)

logger = logging.getLogger(__name__)


class ExecutorService:
    """
    ExecutorService implements all required business-logic. It uses additional services and utils as helpers
    e.g. ExecutorCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: ExecutorCRUD,
        integration_service: IntegrationService,
        permission_service: PermissionService,
        service_source_code: SourceCodeService,
        storage_service: StorageService,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        log_service: LogService,
        task_service: TaskEntityService,
        favorite_service: FavoriteService,
        tool_service: ToolService,
        worker_template_service: WorkerTemplateService,
        project_crud: ProjectCRUD,
        subscription_service: SubscriptionService,
    ):
        self.crud: ExecutorCRUD = crud
        self.integration_service: IntegrationService = integration_service
        self.permission_service: PermissionService = permission_service
        self.service_source_code: SourceCodeService = service_source_code
        self.storage_service: StorageService = storage_service
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.log_service: LogService = log_service
        self.task_service: TaskEntityService = task_service
        self.favorite_service: FavoriteService = favorite_service
        self.tool_service: ToolService = tool_service
        self.worker_template_service: WorkerTemplateService = worker_template_service
        self.project_crud: ProjectCRUD = project_crud
        self.subscription_service: SubscriptionService = subscription_service

    async def get_dto_by_id(self, executor_id: str | UUID) -> ExecutorDTO | None:
        if not is_valid_uuid(executor_id):
            raise ValueError(f"Invalid executor ID: {executor_id}")

        executor = await self.crud.get_by_id(executor_id)
        if executor is None:
            return None
        return ExecutorDTO.model_validate(executor)

    async def get_by_id(self, executor_id: str | UUID) -> ExecutorResponse | None:
        if not is_valid_uuid(executor_id):
            raise ValueError(f"Invalid executor ID: {executor_id}")

        executor = await self.crud.get_by_id(executor_id)
        if executor is None:
            return None
        return ExecutorResponse.model_validate(executor)

    async def get_all(self, **kwargs) -> list[ExecutorResponse]:
        executors = await self.crud.get_all(**kwargs)
        return [ExecutorResponse.model_validate(executor) for executor in executors]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, executor_id: str | UUID, fields: FieldSpec | None = None) -> Executor | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(executor_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Executor]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def get_actions(self, executor_id: str | UUID, requester: UserDTO) -> list[str]:
        executor = await self.crud.get_by_id(
            executor_id,
            fields={"status": None, "state": None, "project": {"id": None, "owners": {"id": None}}},
        )
        if not executor:
            raise EntityNotFound("Executor not found")
        return await get_executor_actions(requester, executor.id, executor.status, executor.state, executor.project)

    async def validate_project(self, project_id: str | UUID, requester: UserDTO) -> None:
        """An executor can only be added to an enabled project the requester can write to or owns."""
        project = require_enabled_project(await self.project_crud.get_by_id(project_id))
        permissions = await get_project_permissions(requester, project)
        if "write" not in permissions and "admin" not in permissions:
            raise AccessDenied(f"You don't have write access to project {project.id}")

    async def create_executor(
        self,
        executor: ExecutorCreate,
        requester: UserDTO,
    ) -> Executor:
        """
        Create a new executor.
        :param executor: ExecutorCreate to create
        :param requester: User who creates the executor
        :return: ORM model of the created executor
        """

        if not (executor.source_code_version or executor.source_code_branch):
            raise ValueError("One of source code tag or branch is required")

        if executor.source_code_version and executor.source_code_branch:
            raise ValueError("Only one of source code tag or branch is allowed")

        source_code = await self.service_source_code.get_by_id(executor.source_code_id)
        if source_code is None:
            raise EntityNotFound("Source code not found")

        if source_code.status == ModelStatus.DISABLED:
            raise EntityWrongState("SourceCode is not enabled")

        if executor.runtime in ["tofu"] and not executor.storage_id:
            raise ValueError("Storage is required for opentofu executors")

        if executor.storage_id and executor.runtime in ["tofu"]:
            storage = await self.storage_service.get_by_id(executor.storage_id)
            if not storage:
                raise EntityNotFound("Storage not found")

            if storage.state != ModelState.PROVISIONED:
                raise EntityWrongState("Storage is not provisioned")
            if executor.storage_path is None or executor.storage_path == "":
                raise ValueError("Storage path is required for executors with storage")

        if executor.tool_id is not None:
            _ = await self.tool_service.validate_ready(executor.tool_id)

        integration_ids = [i.id if isinstance(i, IntegrationShort) else i for i in executor.integration_ids]
        await require_entity_write_access(requester, "integration", integration_ids)
        await require_entity_write_access(requester, "secret", executor.secret_ids)

        if executor.worker_template_id is not None:
            _ = await self.worker_template_service.validate_selectable(executor.worker_template_id, requester)

        if executor.project_id is not None:
            await self.validate_project(executor.project_id, requester)

        body = executor.model_dump(exclude_unset=True)

        body["created_by"] = requester.id
        new_executor = await self.crud.create(body)
        new_executor.state = ModelState.PROVISION
        new_executor.status = ModelStatus.READY

        result = await self.crud.get_by_id(new_executor.id)

        if not result:
            raise EntityNotFound("Failed to retrieve the created executor")

        await self.revision_handler.handle_revision(new_executor)
        await self.audit_log_handler.create_log(
            new_executor.id, requester.id, ModelActions.CREATE, revision_number=new_executor.revision_number
        )
        response = ExecutorResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        await self.permission_service.casbin_enforcer.send_reload_event()
        return result

    async def update_executor(self, executor_id: str, executor: ExecutorUpdate, requester: UserDTO) -> Executor:
        """
        Update an existing executor.
        :param executor_id: ID of the executor to update
        :param executor: Executor to update
        :param requester: User who updates the executor
        :return: ORM model of the updated executor
        """

        def check_critical_fields_changed(existing: Executor, patched: ExecutorUpdate) -> bool:
            critical_fields = ["storage_id", "storage_path"]
            for field in critical_fields:
                if getattr(patched, field) is not None and getattr(patched, field) != getattr(existing, field):
                    return True
            return False

        existing_executor = await self.crud.get_by_id(executor_id)

        if not existing_executor:
            raise EntityNotFound("Executor not found")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_executor)

        if existing_executor.status in [ModelStatus.DISABLED, ModelStatus.QUEUED, ModelStatus.IN_PROGRESS]:
            raise ValueError(f"Entity cannot be updated, has wrong status {existing_executor.status}")

        if existing_executor.state in [ModelState.DESTROY, ModelState.DESTROYED]:
            raise ValueError(f"Entity cannot be updated, has wrong state {existing_executor.state}")

        if (
            executor.source_code_folder is not None
            and existing_executor.source_code_folder != executor.source_code_folder
        ):
            requester_permissions = await get_executor_permissions(requester, executor_id, existing_executor.project)
            if "admin" not in requester_permissions:
                raise ValueError("Only admin can change source code folder of the executor")

        if executor.source_code_id is not None and existing_executor.source_code_id != executor.source_code_id:
            raise ValueError("Source code ID cannot be changed once set")

        if executor.source_code_id is not None:
            source_code = await self.service_source_code.get_by_id(executor.source_code_id)
            if source_code is None:
                raise EntityNotFound("Source code not found")

        existing_executor_pydantic = ExecutorResponse.model_validate(existing_executor)

        # require write access for integrations and secrets newly added by this patch
        if executor.integration_ids:
            await require_entity_write_access(
                requester,
                "integration",
                executor.integration_ids,
                {str(i.id) for i in existing_executor_pydantic.integration_ids},
            )
        if executor.secret_ids:
            await require_entity_write_access(
                requester,
                "secret",
                executor.secret_ids,
                {str(s.id) for s in existing_executor_pydantic.secret_ids},
            )

        body = model_db_dump(executor, exclude_defaults=True, exclude_none=True)
        if "tool_id" in executor.model_fields_set:
            # tool can be reset to the runtime default, so None is a valid change
            # a disabled tool stays valid for entities already using it
            if executor.tool_id is not None and executor.tool_id != existing_executor.tool_id:
                _ = await self.tool_service.validate_ready(executor.tool_id)
            body["tool_id"] = executor.tool_id
        if "worker_template_id" in executor.model_fields_set:
            # None resets to the global default template
            # a disabled template stays selected, its tasks wait until it is enabled again
            if (
                executor.worker_template_id is not None
                and executor.worker_template_id != existing_executor.worker_template_id
            ):
                _ = await self.worker_template_service.validate_selectable(executor.worker_template_id, requester)
            body["worker_template_id"] = executor.worker_template_id
        if "project_id" in executor.model_fields_set:
            # None detaches the executor from its project
            if executor.project_id is not None and executor.project_id != existing_executor.project_id:
                await self.validate_project(executor.project_id, requester)
            body["project_id"] = executor.project_id

        if not body:
            raise ValueError("No fields to update")

        if not has_field_changes(body, existing_executor):
            raise ValueError("No changes detected; the executor is already up to date.")

        # Source code tag and branch are mutually exclusive; setting one clears the other.
        if body.get("source_code_version"):
            body["source_code_branch"] = None
        elif body.get("source_code_branch"):
            body["source_code_version"] = None

        if check_critical_fields_changed(existing_executor, executor):
            requester_permissions = await get_executor_permissions(requester, executor_id, existing_executor.project)
            if "admin" not in requester_permissions:
                raise ValueError("Only admin can change storage or storage path of the executor")

            if existing_executor.runtime in ["tofu"]:
                storage_id = executor.storage_id or existing_executor.storage_id
                if not storage_id:
                    raise ValueError("Storage is required for opentofu executors")

                storage = await self.storage_service.get_by_id(storage_id)
                if not storage:
                    raise EntityNotFound("Storage not found")

                if storage.state != ModelState.PROVISIONED:
                    raise EntityWrongState("Storage is not provisioned")

        await self.crud.update(existing_executor, body)
        if "worker_template_id" in body:
            # tasks queued before the change must run on the newly selected workers
            _ = await self.worker_template_service.retarget_tasks("executor", existing_executor.id)
        await self.revision_handler.handle_revision(existing_executor)
        await self.audit_log_handler.create_log(
            existing_executor_pydantic.id,
            requester.id,
            ModelActions.UPDATE,
            revision_number=existing_executor.revision_number,
        )
        await self.crud.refresh(existing_executor)

        response = ExecutorResponse.model_validate(existing_executor)
        await self.event_sender.send_event(response, ModelActions.UPDATE)

        return existing_executor

    async def action_destroy(self, existing_executor: Executor, pydantic_executor: ExecutorDTO, requester: UserDTO):
        if pydantic_executor.state in [ModelState.DESTROY, ModelState.DESTROYED]:
            raise ValueError(f"Executor is already in {pydantic_executor.state} state")

        if pydantic_executor.status not in [ModelStatus.DONE, ModelStatus.READY, ModelStatus.ERROR]:
            raise ValueError(f"Cannot destroy a executor in {pydantic_executor.status} status")

        await destroy_entity(existing_executor, is_resource=False)

    async def action_recreate(self, existing_executor: Executor, requester: UserDTO):
        await recreate_entity(existing_executor, is_resource=False)

    async def _last_run_ref_metadata(self, executor_id: UUID | str) -> dict[str, str] | None:
        """The ref of the last execute or retry when it ran from another ref, None when it used the configured one."""
        metadata = await self.audit_log_handler.get_last_action_metadata(
            executor_id, [ModelActions.EXECUTE, ModelActions.RETRY]
        )
        if not metadata or not metadata.get("source_code_ref"):
            return None
        return {
            "source_code_ref": metadata["source_code_ref"],
            "source_code_ref_type": metadata.get("source_code_ref_type") or "ref",
        }

    async def patch_action_executor(
        self,
        executor_id,
        body: PatchBodyModel,
        requester: UserDTO,
        trace_id: str | None = None,
        source_code_branch: str | None = None,
        source_code_version: str | None = None,
    ) -> Executor:
        """
        Patch an existing executor.
        :param executor_id: ID of the executor to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the executor
        :param source_code_branch: run once from this branch instead of the configured ref (execute and dry run)
        :param source_code_version: run once from this tag instead of the configured ref (execute and dry run)
        :return: ORM model of the patched executor
        """
        existing_executor = await self.crud.get_by_id(executor_id)
        if not existing_executor:
            raise EntityNotFound("Executor not found")

        # wrap existing_executor to pydantic model to avoid sqlalchemy object state issues
        pydantic_executor = ExecutorDTO.model_validate(existing_executor)

        run_ref = resolve_run_ref(existing_executor, source_code_branch, source_code_version)
        run_ref_metadata: dict[str, str] | None = None
        if run_ref is not None:
            if body.action not in [ModelActions.EXECUTE, ModelActions.DRYRUN]:
                raise ValueError("Another branch or tag can only be used to execute or dry run the executor")
            # a dry run runs the ref's code too (providers, data sources) with the executor's credentials and
            # secrets, and only admins choose which code the executor runs
            requester_permissions = await get_executor_permissions(
                requester, existing_executor.id, existing_executor.project
            )
            if "admin" not in requester_permissions:
                raise AccessDenied("Only executor admins can run the executor from another branch or tag")
            run_ref_metadata = {"source_code_ref": run_ref[0], "source_code_ref_type": run_ref[1]}
        elif body.action == ModelActions.RETRY:
            # the executor is queued by an execute (or an earlier retry), retry it from the same ref
            run_ref_metadata = await self._last_run_ref_metadata(existing_executor.id)

        # kwargs for the audit row and the task, only set when running from another ref
        audit_ref_kwargs: dict[str, Any] = {}
        task_ref_kwargs: dict[str, Any] = {}
        if run_ref_metadata:
            audit_ref_kwargs["action_metadata"] = run_ref_metadata
            task_ref_kwargs["extra_metadata"] = run_ref_metadata

        await self.audit_log_handler.create_log(
            pydantic_executor.id,
            requester.id,
            body.action,
            revision_number=pydantic_executor.revision_number,
            **audit_ref_kwargs,
        )

        match body.action:
            case ModelActions.RETRY:
                if existing_executor.status == ModelStatus.QUEUED:
                    await self.event_sender.send_task(
                        existing_executor.id,
                        requester=requester,
                        trace_id=trace_id or self.audit_log_handler.trace_id,
                        audit_log_id=self.audit_log_handler.audit_log_id,
                        action=ModelActions.EXECUTE,
                        **task_ref_kwargs,
                    )
                else:
                    raise EntityWrongState("Only executors in QUEUED status can be retried")

            case ModelActions.DESTROY:
                await self.action_destroy(existing_executor, pydantic_executor, requester)
            case ModelActions.EXECUTE:
                await execute_entity(existing_executor)
                await self.event_sender.send_task(
                    pydantic_executor.id,
                    requester=requester,
                    trace_id=trace_id or self.audit_log_handler.trace_id,
                    audit_log_id=self.audit_log_handler.audit_log_id,
                    **task_ref_kwargs,
                )
            case ModelActions.DRYRUN:
                if existing_executor.status not in [
                    ModelStatus.READY,
                    ModelStatus.ERROR,
                    ModelStatus.DONE,
                ]:
                    raise EntityWrongState(
                        "Dry run is only allowed for executors in READY, ERROR, APPROVAL_PENDING, or DONE",
                    )
                await self.event_sender.send_task(
                    existing_executor.id,
                    requester=requester,
                    action=ModelActions.DRYRUN,
                    trace_id=trace_id or self.audit_log_handler.trace_id,
                    audit_log_id=self.audit_log_handler.audit_log_id,
                    **task_ref_kwargs,
                )
            case ModelActions.RECREATE:
                await self.action_recreate(existing_executor, requester)

            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = ExecutorResponse.model_validate(existing_executor)
        await self.event_sender.send_event(response, body.action)
        return existing_executor

    async def delete(self, executor_id: str, requester: UserDTO) -> None:
        existing_executor = await self.crud.get_by_id(executor_id)
        if not existing_executor:
            raise EntityNotFound("Executor not found")

        await self.favorite_service.delete_all_by_component(component_type="executor", component_id=executor_id)

        await delete_entity(existing_executor)
        # the executor and its revisions are gone afterwards, so the row keeps a snapshot
        await self.audit_log_handler.create_log(
            executor_id,
            requester.id,
            ModelActions.DELETE,
            action_metadata=build_executor_audit_snapshot(existing_executor),
        )
        await self.revision_handler.delete_revisions(executor_id)
        await self.log_service.delete_by_entity_id(executor_id)
        await self.task_service.delete_by_entity_id(executor_id)
        await self.subscription_service.delete_many_by_entity_id("executor", executor_id)
        await delete_executor_policies(executor_id, self.permission_service)
        await self.crud.delete(existing_executor)
