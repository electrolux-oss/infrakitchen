import logging
from typing import Any
from uuid import UUID

from application.source_codes.model import SourceCodeDTO
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from core.database import to_dict
from core.errors import DependencyError, EntityNotFound, EntityWrongState
from core.logs.service import LogService
from core.revisions.handler import RevisionHandler
from core.tasks.service import TaskEntityService
from core.users.functions import user_api_permission
from core.utils.event_sender import EventSender
from .crud import SourceCodeCRUD
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

    async def create(self, source_code: SourceCodeCreate, requester: UserDTO) -> SourceCodeResponse:
        """
        Create a new source_code.
        :param source_code: SourceCodeCreate to create
        :param requester: User who creates the source_code
        :return: Created source_code
        """
        body = source_code.model_dump(exclude_unset=True)
        body["created_by"] = requester.id
        source_code_to_create = await self.crud.create(body)
        source_code_to_create.status = ModelStatus.READY
        created_source_code = await self.crud.get_by_id(source_code_to_create.id)

        await self.revision_handler.handle_revision(source_code_to_create)
        await self.audit_log_handler.create_log(source_code_to_create.id, requester.id, ModelActions.CREATE)
        response = SourceCodeResponse.model_validate(created_source_code)
        await self.event_sender.send_event(response, ModelActions.CREATE)

        return SourceCodeResponse.model_validate(response)

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
        body = source_code.model_dump(exclude_unset=True)
        existing_source_code = await self.crud.get_by_id(source_code_id)

        if not existing_source_code:
            raise EntityNotFound("SourceCode not found")

        if existing_source_code.status in [ModelStatus.IN_PROGRESS, ModelStatus.DISABLED, ModelStatus.QUEUED]:
            logger.error(f"Entity has wrong status for updating {existing_source_code.status}")
            raise EntityWrongState(f"Entity has wrong status for updating {existing_source_code.status}")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_source_code)

        existing_source_code.status = ModelStatus.READY

        await self.audit_log_handler.create_log(source_code_id, requester.id, ModelActions.UPDATE)
        await self.crud.update(existing_source_code, body)

        await self.revision_handler.handle_revision(existing_source_code)

        await self.crud.refresh(existing_source_code)
        response = SourceCodeResponse.model_validate(existing_source_code)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return response

    async def patch(self, source_code_id, body: PatchBodyModel, requester: UserDTO) -> SourceCodeResponse:
        """
        Patch an existing source_code.
        :param source_code_id: ID of the source_code to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the source_code
        :return: Patched source_code
        """
        existing_source_code = await self.crud.get_by_id(source_code_id)
        if not existing_source_code:
            raise EntityNotFound("SourceCode not found")

        await self.audit_log_handler.create_log(existing_source_code.id, requester.id, body.action)

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
                    action=ModelActions.SYNC,
                )
            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = SourceCodeResponse.model_validate(existing_source_code)
        await self.event_sender.send_event(response, body.action)
        return response

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

    async def get_actions(self, source_code_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the source_code.
        :param source_code_id: ID of the source_code
        :return: List of actions
        """
        apis = await user_api_permission(requester, "source_code_version")
        if not apis:
            return []
        requester_permissions = [apis["api:source_code"]]

        if "write" not in requester_permissions and "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        source_code = await self.crud.get_by_id(source_code_id)
        if not source_code:
            raise EntityNotFound("SourceCode not found")

        if "admin" not in requester_permissions:
            return []

        if source_code.status == ModelStatus.IN_PROGRESS:
            return []

        if source_code.status in [ModelStatus.READY, ModelStatus.ERROR, ModelStatus.DONE]:
            actions.append(ModelActions.SYNC)
            actions.append(ModelActions.EDIT)
            actions.append(ModelActions.DISABLE)
            return actions

        if source_code.status == ModelStatus.DISABLED:
            actions.append(ModelActions.ENABLE)
            actions.append(ModelActions.DELETE)
            return actions

        return actions
