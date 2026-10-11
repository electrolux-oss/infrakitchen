import logging
from typing import Any
from uuid import UUID

from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.database import FieldSpec, to_dict
from core.errors import EntityExistsError, EntityNotFound, EntityWrongState
from core.revisions.handler import RevisionHandler
from core.users.model import UserDTO
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump

from .crud import WorkerTemplateCRUD
from .functions import get_worker_template_actions
from .model import WorkerTemplate, WorkerTemplateDTO
from .providers import WORKER_PROVIDERS, WorkerInstance, get_worker_provider, get_worker_provider_class
from .schema import WorkerTemplateCreate, WorkerTemplateResponse, WorkerTemplateUpdate

logger = logging.getLogger(__name__)


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
    ):
        self.crud: WorkerTemplateCRUD = crud
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, worker_template_id: str | UUID) -> WorkerTemplateResponse | None:
        worker_template = await self.crud.get_by_id(worker_template_id)
        if worker_template is None:
            return None
        return WorkerTemplateResponse.model_validate(worker_template)

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
        worker_template = await self.crud.get_by_id(worker_template_id, fields={"status": None})
        if not worker_template:
            raise EntityNotFound("Worker template not found")
        return await get_worker_template_actions(requester, worker_template.status)

    @staticmethod
    def list_providers() -> list[str]:
        return list(WORKER_PROVIDERS.keys())

    @staticmethod
    def get_default_configuration(provider: str) -> dict[str, Any]:
        return get_worker_provider_class(provider).default_configuration()

    async def list_instances(self, worker_template_id: str | UUID) -> list[WorkerInstance]:
        worker_template = await self.crud.get_by_id(worker_template_id)
        if not worker_template:
            raise EntityNotFound("Worker template not found")
        provider = get_worker_provider(WorkerTemplateDTO.model_validate(worker_template))
        return await provider.list_instances()

    async def validate(self, worker_template_id: str | UUID) -> None:
        worker_template = await self.crud.get_by_id(worker_template_id)
        if not worker_template:
            raise EntityNotFound("Worker template not found")
        provider = get_worker_provider(WorkerTemplateDTO.model_validate(worker_template))
        await provider.validate()

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

        if worker_template.configuration is not None and worker_template.configuration.provider != existing.provider:
            raise ValueError("Worker provider cannot be changed")

        self.revision_handler.original_entity_instance_dump = to_dict(existing)

        body = model_db_dump(worker_template, exclude_unset=True, exclude_none=True)
        if not has_field_changes(body, existing):
            raise ValueError("No changes detected; the worker template is already up to date.")

        await self.crud.update(existing, body)

        await self.revision_handler.handle_revision(existing)
        await self.audit_log_handler.create_log(
            worker_template_id, requester.id, ModelActions.UPDATE, revision_number=existing.revision_number
        )
        await self.crud.refresh(existing)

        response = WorkerTemplateResponse.model_validate(existing)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return existing

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
                existing.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing.status == ModelStatus.DISABLED:
                    existing.status = ModelStatus.ENABLED
                    existing.last_error = None
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

        await self.audit_log_handler.create_log(worker_template_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(worker_template_id)
        await self.crud.delete(existing)
