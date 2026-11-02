import logging
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from core.adapters.provider_adapters import ACTIVE_PHASES, WorkerInstance, WorkerProviderAdapter
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.database import FieldSpec, to_dict
from core.errors import AccessDenied, DependencyError, EntityExistsError, EntityNotFound, EntityWrongState
from core.revisions.handler import RevisionHandler
from core.task_queue.model import EntityQueueStatus, WaitingReason
from core.users.model import UserDTO
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump
from core.workers.schema import WorkerResponse
from core.workers.service import WorkerService

from .crud import WorkerTemplateCRUD
from .functions import autoscaler_lock, can_select_worker_template, get_worker_template_actions
from .model import WorkerTemplate, WorkerTemplateDTO
from application.tools.worker_manager import (
    get_default_worker_configuration,
    get_worker_provider,
    list_worker_providers,
)
from .schema import WorkerTemplateCreate, WorkerTemplateResponse, WorkerTemplateUpdate

logger = logging.getLogger(__name__)

MAX_LOG_LINES = 5000


def _log_tail(tail: int) -> int:
    return max(1, min(tail, MAX_LOG_LINES))


class WorkerTemplateService:
    """
    WorkerTemplateService manages templates that describe how on-demand task workers are spawned.
    """

    def __init__(
        self,
        crud: WorkerTemplateCRUD,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        worker_service: WorkerService,
    ):
        self.crud: WorkerTemplateCRUD = crud
        self.worker_service: WorkerService = worker_service
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, worker_template_id: str | UUID) -> WorkerTemplateResponse | None:
        worker_template = await self.crud.get_by_id(worker_template_id)
        if worker_template is None:
            return None
        return WorkerTemplateResponse.model_validate(worker_template)

    async def get_all(self, **kwargs: Any) -> list[WorkerTemplateResponse]:
        worker_templates = await self.crud.get_all(**kwargs)
        return [WorkerTemplateResponse.model_validate(worker_template) for worker_template in worker_templates]

    async def get_status(self, worker_template_id: UUID) -> ModelStatus | None:
        """Status of the template, None once it is deleted."""
        return await self.crud.get_status(worker_template_id)

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(
        self, worker_template_id: str | UUID, fields: FieldSpec | None = None
    ) -> WorkerTemplate | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(worker_template_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[WorkerTemplate]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def get_actions(self, worker_template_id: str | UUID, requester: UserDTO) -> list[str]:
        worker_template = await self.crud.get_by_id(worker_template_id, fields={"status": None, "is_default": None})
        if not worker_template:
            raise EntityNotFound("Worker template not found")
        return await get_worker_template_actions(requester, worker_template.status, worker_template.is_default)

    async def validate_selectable(self, worker_template_id: str | UUID, requester: UserDTO) -> WorkerTemplateResponse:
        """Ensure the requester may select the template on an entity and that it is enabled.

        Templates differ in what their workers can reach (e.g. a ServiceAccount), so selecting one
        needs access to worker templates; everyone else gets the global default.
        """
        if not await can_select_worker_template(requester):
            raise AccessDenied("Selecting a worker template requires access to worker templates")
        return WorkerTemplateResponse.model_validate(
            self._ensure_enabled(await self.crud.get_by_id(worker_template_id))
        )

    @staticmethod
    def _ensure_enabled(worker_template: WorkerTemplate | None) -> WorkerTemplate:
        if worker_template is None:
            raise EntityNotFound("Worker template not found")
        if worker_template.status != ModelStatus.ENABLED:
            raise EntityWrongState(f"Worker template {worker_template.name} is disabled")
        return worker_template

    async def get_default(self) -> WorkerTemplateResponse | None:
        worker_template = await self.crud.get_default()
        return WorkerTemplateResponse.model_validate(worker_template) if worker_template else None

    async def set_default(self, worker_template_id: str | UUID | None, requester: UserDTO) -> WorkerTemplate | None:
        """
        Make the template the global default, used by resources and executors without a selected
        template and by all other tasks. None clears the default, so those tasks run on static workers.
        """
        await self.crud.lock_default()
        previous = await self.crud.get_default()
        worker_template = (
            None if worker_template_id is None else self._ensure_enabled(await self.crud.get_by_id(worker_template_id))
        )
        await self.crud.set_default(worker_template)

        changed = {t.id: t for t in (worker_template, previous) if t is not None}
        for template in changed.values():
            await self.audit_log_handler.create_log(template.id, requester.id, ModelActions.UPDATE)
            # the previous default is cleared by a bulk update, reload it before sending
            await self.crud.refresh(template)
            await self.event_sender.send_event(WorkerTemplateResponse.model_validate(template), ModelActions.UPDATE)

        _ = await self.retarget_tasks()
        return worker_template

    async def retarget_tasks(self, entity: str | None = None, entity_id: UUID | None = None) -> int:
        """Route queued tasks again after the default or an entity's selection changed.

        Without ``entity`` every queued task is routed again. Runs in the caller's transaction.
        """
        return await self.crud.retarget_queued_tasks(entity=entity, entity_id=entity_id)

    async def describe_queue_pools(self, statuses: dict[UUID, EntityQueueStatus]) -> None:
        """Add what only worker templates know to the queue status of entities: the template names,
        and why their tasks wait when the template is disabled or its workers keep failing."""
        tasks = [task for status in statuses.values() for task in status.tasks if task.worker_template_id]
        template_ids = {t.worker_template_id for t in tasks if t.worker_template_id}
        pools = {row.id: row for row in await self.crud.get_pool_infos(template_ids)}
        for task in tasks:
            pool = pools.get(task.worker_template_id)
            if pool is None:
                continue
            task.worker_template_name = pool.name
            if task.pool_reason is None:
                continue
            reason = task.pool_reason
            if pool.status != ModelStatus.ENABLED:
                reason = WaitingReason.TEMPLATE_DISABLED
            elif reason == WaitingReason.SPAWNING and pool.last_error:
                reason = WaitingReason.TEMPLATE_BACKOFF
            if task.waiting_reason == task.pool_reason:
                task.waiting_reason = reason
            task.pool_reason = reason

    async def set_last_error(self, worker_template_id: UUID, error: str | None) -> None:
        await self.crud.set_last_error(worker_template_id, error)

    async def set_spawn_backoff(
        self, worker_template_id: UUID, failures: int, blocked_until: datetime | None, failed_at: datetime | None
    ) -> None:
        """Store the autoscaler's backoff, shared by every scheduler process."""
        await self.crud.set_backoff(worker_template_id, failures, blocked_until, failed_at)

    @staticmethod
    def list_providers() -> list[str]:
        return list_worker_providers()

    @staticmethod
    def get_default_configuration(provider: str) -> dict[str, Any]:
        return get_default_worker_configuration(provider)

    async def list_instances(self, worker_template_id: str | UUID) -> list[WorkerInstance]:
        worker_template = await self.crud.get_by_id(worker_template_id)
        if not worker_template:
            raise EntityNotFound("Worker template not found")
        provider = get_worker_provider(WorkerTemplateDTO.model_validate(worker_template))
        return await provider.list_instances()

    async def _find_instance(
        self, worker_template_id: str | UUID, instance_id: str
    ) -> tuple[WorkerProviderAdapter, WorkerInstance]:
        worker_template = await self.crud.get_by_id(worker_template_id)
        if not worker_template:
            raise EntityNotFound("Worker template not found")
        provider = get_worker_provider(WorkerTemplateDTO.model_validate(worker_template))
        # Only instances of this template, so the id cannot be used to read any other container
        instance = next((i for i in await provider.list_instances() if i.id == instance_id), None)
        if instance is None:
            raise EntityNotFound("Worker instance not found")
        return provider, instance

    async def get_instance_logs(self, worker_template_id: str | UUID, instance_id: str, tail: int = 500) -> str:
        provider, instance = await self._find_instance(worker_template_id, instance_id)
        return await provider.get_logs(instance, _log_tail(tail))

    async def get_worker_logs(self, worker_template_id: str | None, worker_host: str, tail: int = 500) -> str:
        """Logs of a registered worker, found among the instances of the template it was spawned from."""
        worker_template = await self.crud.get_by_id(worker_template_id) if worker_template_id else None
        if worker_template is not None:
            provider = get_worker_provider(WorkerTemplateDTO.model_validate(worker_template))
            instance = next((i for i in await provider.list_instances() if i.host == worker_host), None)
            if instance is not None:
                return await provider.get_logs(instance, _log_tail(tail))
        raise EntityNotFound("Logs are only available for running or recently finished on-demand workers")

    async def get_instance_manifest(self, worker_template_id: str | UUID, instance_id: str) -> dict[str, Any]:
        provider, instance = await self._find_instance(worker_template_id, instance_id)
        return await provider.get_manifest(instance)

    async def workers_by_host(self, hosts: list[str]) -> dict[str, WorkerResponse]:
        """The latest registered worker of each host."""
        if not hosts:
            return {}
        # Later rows win, so each host maps to its most recently updated worker
        return {worker.host: worker for worker in await self.worker_service.get_by_hosts(hosts)}

    async def validate(self, worker_template_id: str | UUID) -> None:
        worker_template = await self.crud.get_by_id(worker_template_id)
        if not worker_template:
            raise EntityNotFound("Worker template not found")
        provider = get_worker_provider(WorkerTemplateDTO.model_validate(worker_template))
        await provider.validate()

    async def validate_draft(self, worker_template: WorkerTemplateCreate, requester: UserDTO) -> None:
        """Validate a template that has not been saved yet."""
        draft = WorkerTemplateDTO(
            id=uuid4(),
            created_by=requester.id,
            **worker_template.model_dump(),
        )
        await get_worker_provider(draft).validate()

    async def create_worker_template(self, worker_template: WorkerTemplateCreate, requester: UserDTO) -> WorkerTemplate:
        if await self.crud.count(filter={"name": worker_template.name}):
            raise EntityExistsError(f"Worker template '{worker_template.name}' already exists")

        body = model_db_dump(worker_template)
        body["created_by"] = requester.id
        body["status"] = ModelStatus.ENABLED

        new_worker_template = await self.crud.create(body)
        result = await self.crud.get_by_id(new_worker_template.id)
        if not result:
            raise EntityNotFound("Worker template not found after creation")

        await self.revision_handler.handle_revision(new_worker_template)
        await self.audit_log_handler.create_log(
            new_worker_template.id,
            requester.id,
            ModelActions.CREATE,
            revision_number=new_worker_template.revision_number,
        )
        response = WorkerTemplateResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return result

    async def update_worker_template(
        self, worker_template_id: str, worker_template: WorkerTemplateUpdate, requester: UserDTO
    ) -> WorkerTemplate:
        existing = await self.crud.get_by_id(worker_template_id)
        if not existing:
            raise EntityNotFound("Worker template not found")

        if worker_template.configuration is not None:
            if worker_template.configuration.provider != existing.provider:
                raise ValueError("Worker provider cannot be changed")
            await self._ensure_location_unchanged(existing, worker_template)

        self.revision_handler.original_entity_instance_dump = to_dict(existing)

        body = model_db_dump(worker_template, exclude_unset=True, exclude_none=True)
        if not has_field_changes(body, existing):
            raise ValueError("No changes detected; the worker template is already up to date.")

        if "configuration" in body and body["configuration"] != existing.configuration:
            # a fixed configuration deserves a new try right away
            self._reset_backoff(existing)
        await self.crud.update(existing, body)

        await self.revision_handler.handle_revision(existing)
        await self.audit_log_handler.create_log(
            worker_template_id, requester.id, ModelActions.UPDATE, revision_number=existing.revision_number
        )
        await self.crud.refresh(existing)

        response = WorkerTemplateResponse.model_validate(existing)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return existing

    @staticmethod
    def _reset_backoff(worker_template: WorkerTemplate) -> None:
        """Let the autoscaler spawn from the template again at once (failures already counted stay counted)."""
        worker_template.spawn_failures = 0
        worker_template.spawn_blocked_until = None

    @staticmethod
    async def _ensure_location_unchanged(existing: WorkerTemplate, worker_template: WorkerTemplateUpdate) -> None:
        """Workers are only found where the template spawns them, e.g. its namespace:
        moving it while it has workers would leave them running unmanaged."""
        current = WorkerTemplateDTO.model_validate(existing)
        updated = current.model_copy(update={"configuration": worker_template.configuration})
        provider = get_worker_provider(current)
        if provider.location == get_worker_provider(updated).location:
            return
        instances = await provider.list_instances()
        if instances:
            raise EntityWrongState(
                f"Worker template still has {len(instances)} worker(s) in {provider.location}; "
                + "disable it and wait until they are cleaned up before moving it"
            )

    async def patch_action_worker_template(
        self, worker_template_id: str, body: PatchBodyModel, requester: UserDTO
    ) -> WorkerTemplate:
        existing = await self.crud.get_by_id(worker_template_id)
        if not existing:
            raise EntityNotFound("Worker template not found")

        await self.audit_log_handler.create_log(
            existing.id, requester.id, body.action, revision_number=existing.revision_number
        )
        match body.action:
            case ModelActions.DISABLE:
                if existing.is_default:
                    raise EntityWrongState(
                        "Worker template is the global default, select another default or clear it first"
                    )
                existing.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing.status == ModelStatus.DISABLED:
                    existing.status = ModelStatus.ENABLED
                    existing.last_error = None
                    self._reset_backoff(existing)
                else:
                    raise EntityWrongState("Worker template is already enabled")
            case _:
                raise ValueError("Invalid action")

        response = WorkerTemplateResponse.model_validate(existing)
        await self.event_sender.send_event(response, body.action)
        return existing

    async def delete(self, worker_template_id: str, requester: UserDTO) -> None:
        existing = await self.crud.get_by_id(worker_template_id)
        if not existing:
            raise EntityNotFound("Worker template not found")

        if existing.status == ModelStatus.ENABLED:
            raise EntityWrongState("Worker template must be disabled before deletion")

        dependencies = await self.crud.get_dependencies(existing)
        if dependencies:
            raise DependencyError(
                "Cannot delete a worker template that is selected by other entities",
                metadata=[
                    {"id": dependency.id, "name": dependency.name, "entityName": dependency.type}
                    for dependency in dependencies
                ],
            )

        # Its workers are only cleaned up while the template exists, so wait until they exited.
        # Under the autoscaler lock: a pass that read the template while it was enabled may still be spawning
        provider = get_worker_provider(WorkerTemplateDTO.model_validate(existing))
        async with autoscaler_lock() as locked:
            if not locked:
                raise EntityWrongState("Workers are being scaled right now, try again in a moment")
            instances = await provider.list_instances()
            live = [i for i in instances if i.phase in ACTIVE_PHASES]
            if live:
                raise EntityWrongState(
                    f"Worker template still has {len(live)} running worker(s); "
                    + "they exit after the idle timeout, delete the template afterwards"
                )
            _ = await self.worker_service.delete_by_hosts([i.host for i in instances])
            for instance in instances:
                await provider.delete_instance(instance)

        await self.audit_log_handler.create_log(worker_template_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(worker_template_id)
        await self.crud.delete(existing)
