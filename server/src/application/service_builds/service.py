import logging
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from application.integrations.model import Integration
from application.services.crud import ServiceCRUD
from application.source_codes.model import SourceCodeCommit
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import ServiceBuildCRUD
from .model import BuildImage, ServiceBuild
from .registry import get_container_registry
from .schema import ServiceBuildResponse, validate_image_tag

logger = logging.getLogger(__name__)


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

    async def create_build(
        self, service_id: str | UUID, commit_sha: str, requester: UserDTO, tag: str | None = None
    ) -> ServiceBuild:
        service = await self.service_crud.get_by_id(service_id)
        if not service:
            raise EntityNotFound("Service not found")
        if not service.source_code_id:
            raise ValueError("Link a code repository to the service before building it")
        if not service.registries:
            raise ValueError("Add an image registry to the service before building it")

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

        tag = validate_image_tag(tag or commit_sha)
        if existing := await self.crud.get_by_tag(service.id, tag):
            raise EntityWrongState(
                f"Tag {tag} is already used by the build of commit {existing.commit_sha[:7]}; build with another tag"
            )
        if not await self.crud.started_failed_build_exists(service.id, commit_sha, tag):
            for registry in service.registries:
                await self._assert_tag_not_pushed(registry.registry_integration, registry.image_repository, tag)

        try:
            build = await self.crud.create(
                {
                    "service_id": service.id,
                    "commit_sha": commit_sha,
                    "images": [
                        BuildImage(
                            registry_integration_id=str(registry.registry_integration_id),
                            registry_name=registry.registry_integration.name,
                            registry_provider=registry.registry_integration.integration_provider,
                            image_repository=registry.image_repository,
                            image=None,
                        )
                        for registry in service.registries
                    ],
                    "tag": tag,
                    "status": ModelStatus.QUEUED,
                    "created_by": requester.id,
                }
            )
        except IntegrityError as e:
            raise EntityWrongState(f"Tag {tag} is already used by another build; build with another tag") from e
        await self.audit_log_handler.create_log(
            service.id,
            requester.id,
            ModelActions.BUILD,
            action_metadata={"build_id": str(build.id), "commit_sha": commit_sha, "tag": build.tag},
        )
        await self.crud.refresh(build)
        await self.event_sender.send_event(ServiceBuildResponse.model_validate(build), ModelActions.CREATE)
        await self.event_sender.send_task(
            build.id,
            requester=requester,
            action=ModelActions.BUILD,
            trace_id=self.audit_log_handler.trace_id,
            audit_log_id=self.audit_log_handler.audit_log_id,
            delay_seconds=0,
        )
        return build

    async def _assert_tag_not_pushed(self, integration: Integration, repository: str, tag: str) -> None:
        try:
            registry = await get_container_registry(self.crud.session, integration)
            exists = await registry.image_tag_exists(repository, tag)
        except httpx.HTTPError as e:
            logger.warning(f"Could not check {repository}:{tag} in {integration.name}: {e}")
            return
        if exists:
            raise EntityWrongState(
                f"{repository}:{tag} is already pushed to {integration.name}; build with another tag"
            )
