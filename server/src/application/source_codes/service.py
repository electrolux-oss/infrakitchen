import logging
from typing import Any
from uuid import UUID

from application.source_codes.model import SourceCode, SourceCodeDTO
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from core.database import FieldSpec, to_dict
from core.errors import DependencyError, EntityNotFound, EntityWrongState
from core.logs.service import LogService
from core.revisions.handler import RevisionHandler
from core.tasks.service import TaskEntityService
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump
from .crud import SourceCodeCRUD
from .functions import get_source_code_actions
from .schema import SourceCodeCreate, SourceCodeResponse, SourceCodeUpdate
from core.users.model import UserDTO

from core.constants import ModelStatus

logger = logging.getLogger(__name__)


class SourceCodeService:
    """
    SourceCodeService implements all required business-logic. It uses additional services and utils as helpers
    e.g. SourceCodeCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: SourceCodeCRUD,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        log_service: LogService,
        task_service: TaskEntityService,
    ):
        self.crud: SourceCodeCRUD = crud
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.log_service: LogService = log_service
        self.task_service: TaskEntityService = task_service

    async def get_dto_by_id(self, source_code_id: str | UUID) -> SourceCodeDTO | None:
        source_code = await self.crud.get_by_id(source_code_id)
        if source_code is None:
            return None
        return SourceCodeDTO.model_validate(source_code)

    async def get_by_id(self, source_code_id: str | UUID) -> SourceCodeResponse | None:
        source_code = await self.crud.get_by_id(source_code_id)
        if source_code is None:
            return None
        return SourceCodeResponse.model_validate(source_code)

    async def get_one(self, **kwargs) -> SourceCodeResponse | None:
        source_code = await self.crud.get_one(**kwargs)
        if source_code is None:
            return None
        return SourceCodeResponse.model_validate(source_code)

    async def get_all(self, **kwargs) -> list[SourceCodeResponse]:
        source_codes = await self.crud.get_all(**kwargs)
        return [SourceCodeResponse.model_validate(source_code) for source_code in source_codes]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, source_code_id: str | UUID, fields: FieldSpec | None = None) -> SourceCode | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(source_code_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[SourceCode]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def get_actions(self, source_code_id: str | UUID, requester: UserDTO) -> list[str]:
        source_code = await self.crud.get_by_id(source_code_id, fields={"status": None})
        if not source_code:
            raise EntityNotFound("Source code not found")
        return await get_source_code_actions(requester, source_code.status)

    async def create_source_code(self, source_code: SourceCodeCreate, requester: UserDTO) -> SourceCode:
        """
        Create a new source_code and return the ORM model.
        :param source_code: SourceCodeCreate to create
        :param requester: User who creates the source_code
        :return: Created source_code ORM model
        """
        body = source_code.model_dump(exclude_unset=True)
        body["created_by"] = requester.id
        source_code_to_create = await self.crud.create(body)
        source_code_to_create.status = ModelStatus.READY
        created_source_code = await self.crud.get_by_id(source_code_to_create.id)

        if not created_source_code:
            raise EntityNotFound("SourceCode not found after creation")

        await self.revision_handler.handle_revision(source_code_to_create)
        await self.audit_log_handler.create_log(
            source_code_to_create.id,
            requester.id,
            ModelActions.CREATE,
            revision_number=source_code_to_create.revision_number,
        )
        response = SourceCodeResponse.model_validate(created_source_code)
        await self.event_sender.send_event(response, ModelActions.CREATE)

        return created_source_code

    async def create(self, source_code: SourceCodeCreate, requester: UserDTO) -> SourceCodeResponse:
        """
        Create a new source_code.
        :param source_code: SourceCodeCreate to create
        :param requester: User who creates the source_code
        :return: Created source_code
        """
        created_source_code = await self.create_source_code(source_code=source_code, requester=requester)
        return SourceCodeResponse.model_validate(created_source_code)

    async def update_source_code(
        self, source_code_id: str, source_code: SourceCodeUpdate, requester: UserDTO
    ) -> SourceCode:
        """
        Update an existing source_code and return the ORM model.
        :param source_code_id: ID of the source_code to update
        :param source_code: SourceCode to update
        :param requester: User who updates the source_code
        :return: Updated source_code ORM model
        """
        body = model_db_dump(source_code, exclude_defaults=True, exclude_none=True)
        existing_source_code = await self.crud.get_by_id(source_code_id)

        if not existing_source_code:
            raise EntityNotFound("SourceCode not found")

        if existing_source_code.status in [ModelStatus.IN_PROGRESS, ModelStatus.DISABLED, ModelStatus.QUEUED]:
            logger.error(f"Entity has wrong status for updating {existing_source_code.status}")
            raise EntityWrongState(f"Entity has wrong status for updating {existing_source_code.status}")

        if not has_field_changes(body, existing_source_code):
            raise ValueError("No changes detected; the source code is already up to date.")
        self.revision_handler.original_entity_instance_dump = to_dict(existing_source_code)

        existing_source_code.status = ModelStatus.READY

        await self.crud.update(existing_source_code, body)

        await self.revision_handler.handle_revision(existing_source_code)
        await self.audit_log_handler.create_log(
            source_code_id, requester.id, ModelActions.UPDATE, revision_number=existing_source_code.revision_number
        )

        await self.crud.refresh(existing_source_code)
        await self.event_sender.send_event(SourceCodeResponse.model_validate(existing_source_code), ModelActions.UPDATE)
        return existing_source_code

    async def update(
        self, source_code_id: str, source_code: SourceCodeUpdate, requester: UserDTO
    ) -> SourceCodeResponse:
        """
        Update an existing source_code.
        :param source_code_id: ID of the source_code to update
        :param source_code: SourceCode to update
        :param requester: User who updates the source_code
        :return: Updated source_code
        """
        existing_source_code = await self.update_source_code(
            source_code_id=source_code_id, source_code=source_code, requester=requester
        )
        return SourceCodeResponse.model_validate(existing_source_code)

    async def patch_action(self, source_code_id, body: PatchBodyModel, requester: UserDTO) -> SourceCode:
        """
        Patch an existing source_code and return the ORM model.
        :param source_code_id: ID of the source_code to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the source_code
        :return: Patched source_code ORM instance
        """
        existing_source_code = await self.crud.get_by_id(source_code_id)
        if not existing_source_code:
            raise EntityNotFound("SourceCode not found")

        await self.audit_log_handler.create_log(
            existing_source_code.id, requester.id, body.action, revision_number=existing_source_code.revision_number
        )

        match body.action:
            case ModelActions.DISABLE:
                existing_source_code.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing_source_code.status == ModelStatus.DISABLED:
                    existing_source_code.status = ModelStatus.READY
                else:
                    raise EntityWrongState("SourceCode is already enabled")
            case ModelActions.SYNC:
                if existing_source_code.status in [ModelStatus.IN_PROGRESS, ModelStatus.DISABLED, ModelStatus.QUEUED]:
                    raise EntityWrongState(f"Entity has wrong status for syncing {existing_source_code.status}")

                await self.event_sender.send_task(
                    existing_source_code.id,
                    requester=requester,
                    trace_id=self.audit_log_handler.trace_id,
                    audit_log_id=self.audit_log_handler.audit_log_id,
                    action=ModelActions.SYNC,
                )
            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = SourceCodeResponse.model_validate(existing_source_code)
        await self.event_sender.send_event(response, body.action)
        return existing_source_code

    async def patch(self, source_code_id, body: PatchBodyModel, requester: UserDTO) -> SourceCodeResponse:
        """
        Patch an existing source_code.
        :param source_code_id: ID of the source_code to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the source_code
        :return: Patched source_code
        """
        result = await self.patch_action(source_code_id=source_code_id, body=body, requester=requester)
        return SourceCodeResponse.model_validate(result)

    async def delete(self, source_code_id: str, requester: UserDTO) -> None:
        existing_source_code = await self.crud.get_by_id(source_code_id)
        if not existing_source_code:
            raise EntityNotFound("SourceCode not found")

        if existing_source_code.status != ModelStatus.DISABLED:
            raise EntityWrongState(f"Entity has wrong status for deletion {existing_source_code.status}")

        dependencies = await self.crud.get_dependencies(existing_source_code)
        if dependencies:
            raise DependencyError(
                "Cannot delete a source_code that has dependencies",
                metadata=[
                    {
                        "id": dependency.id,
                        "name": dependency.name,
                        "_entity_name": dependency.type,
                    }
                    for dependency in dependencies
                ],
            )

        await self.audit_log_handler.create_log(source_code_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(source_code_id)
        await self.log_service.delete_by_entity_id(source_code_id)
        await self.task_service.delete_by_entity_id(source_code_id)

        await self.crud.delete(existing_source_code)
