from uuid import UUID

from sqlalchemy import select

from application.services.crud import ServiceCRUD
from application.source_codes.model import SourceCodeCommit
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import ServiceBuildCRUD
from .ecr import get_ecr_repository
from .model import ServiceBuild
from .schema import ServiceBuildResponse


class ServiceBuildService:
    def __init__(
        self,
        crud: ServiceBuildCRUD,
        service_crud: ServiceCRUD,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud: ServiceBuildCRUD = crud
        self.service_crud: ServiceCRUD = service_crud
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_builds(
        self,
        service_id: str | UUID,
        commit_shas: list[str] | None = None,
        range: tuple[int, int] | None = None,
    ) -> list[ServiceBuild]:
        return await self.crud.get_by_service(service_id, commit_shas=commit_shas, range=range)

    async def count_builds(self, service_id: str | UUID) -> int:
        return await self.crud.count_by_service(service_id)

    async def create_build(self, service_id: str | UUID, commit_sha: str, requester: UserDTO) -> ServiceBuild:
        service = await self.service_crud.get_by_id(service_id)
        if not service:
            raise EntityNotFound("Service not found")
        if not service.source_code_id:
            raise ValueError("Link a code repository to the service before building it")
        if not service.image_resource:
            raise ValueError("Choose the image repository resource before building the service")
        _ = get_ecr_repository(service.image_resource)

        commit = (
            await self.crud.session.execute(
                select(SourceCodeCommit.sha)
                .where(SourceCodeCommit.source_code_id == service.source_code_id, SourceCodeCommit.sha == commit_sha)
                .limit(1)
            )
        ).scalar_one_or_none()
        if commit is None:
            raise EntityNotFound(f"Commit {commit_sha[:7]} is not in the service's code repository")

        if await self.crud.has_active_build(service.id, commit_sha):
            raise EntityWrongState(f"Commit {commit_sha[:7]} is already being built")

        build = await self.crud.create(
            {
                "service_id": service.id,
                "commit_sha": commit_sha,
                "version": service.version,
                "status": ModelStatus.QUEUED,
                "created_by": requester.id,
            }
        )
        await self.audit_log_handler.create_log(
            service.id,
            requester.id,
            ModelActions.BUILD,
            action_metadata={"build_id": str(build.id), "commit_sha": commit_sha},
        )
        await self.crud.refresh(build)
        await self.event_sender.send_event(ServiceBuildResponse.model_validate(build), ModelActions.CREATE)
        # Nothing offers to cancel a queued build yet, so it is picked up right away
        await self.event_sender.send_task(
            build.id,
            requester=requester,
            action=ModelActions.BUILD,
            trace_id=self.audit_log_handler.trace_id,
            audit_log_id=self.audit_log_handler.audit_log_id,
            delay_seconds=0,
        )
        return build
