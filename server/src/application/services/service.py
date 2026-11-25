import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select

from application.integrations.model import Integration
from application.projects.model import Project
from application.source_codes.model import SourceCode
from application.source_codes.repository import is_ssh_url, repository_key, repository_provider
from application.source_codes.schema import SourceCodeCreate
from application.source_codes.service import SourceCodeService
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelStatus
from core.database import FieldSpec, to_dict
from core.errors import EntityNotFound
from core.notifications.model import Subscription
from core.notifications.service import SubscriptionService
from core.permissions.model import Permission
from core.permissions.schema import EntityPolicyCreate
from core.permissions.service import PermissionService
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump, to_json_serializable
from .functions import get_service_actions
from .crud import ServiceCRUD
from .model import Service
from .schema import ServiceCreate, ServiceResponse, ServiceUpdate
from core.users.model import UserDTO

logger = logging.getLogger(__name__)


class ServiceService:
    def __init__(
        self,
        crud: ServiceCRUD,
        permission_service: PermissionService,
        subscription_service: SubscriptionService,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        source_code_service: SourceCodeService,
    ):
        self.crud: ServiceCRUD = crud
        self.source_code_service: SourceCodeService = source_code_service
        self.permission_service: PermissionService = permission_service
        self.subscription_service: SubscriptionService = subscription_service
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, service_id: str | UUID) -> ServiceResponse | None:
        service = await self.crud.get_by_id(service_id)
        if service is None:
            return None
        return ServiceResponse.model_validate(service)

    async def get_all(self, **kwargs) -> list[ServiceResponse]:
        services = await self.crud.get_all(**kwargs)
        return [ServiceResponse.model_validate(service) for service in services]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, service_id: str | UUID, fields: FieldSpec | None = None) -> Service | None:
        return await self.crud.get_by_id(service_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Service]:
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def _assert_project_exists(self, project_id: str | UUID) -> None:
        project = (
            await self.crud.session.execute(select(Project.id).where(Project.id == project_id))
        ).scalar_one_or_none()
        if project is None:
            raise EntityNotFound(f"Project {project_id} not found")

    async def _assert_source_code_exists(self, source_code_id: str | UUID) -> None:
        source_code = (
            await self.crud.session.execute(select(SourceCode.id).where(SourceCode.id == source_code_id))
        ).scalar_one_or_none()
        if source_code is None:
            raise EntityNotFound(f"Source code {source_code_id} not found")

    async def _assert_git_integration(self, repository_url: str, integration_id: UUID | None) -> UUID:
        if not integration_id:
            raise ValueError("Choose the git integration to clone the repository with")
        integration = (
            await self.crud.session.execute(
                select(Integration.integration_type, Integration.integration_provider).where(
                    Integration.id == integration_id
                )
            )
        ).one_or_none()
        if integration is None:
            raise EntityNotFound(f"Integration {integration_id} not found")
        if integration.integration_type != "git":
            raise ValueError("The repository integration must be a git integration")

        provider = repository_provider(repository_url)
        if is_ssh_url(repository_url):
            allowed = {f"{provider}_ssh"}
        else:
            allowed = {provider, "git_public"}
        if integration.integration_provider not in allowed:
            raise ValueError(
                f"A {integration.integration_provider} integration cannot clone {repository_url}; "
                f"use one of: {', '.join(sorted(allowed))}"
            )
        return integration_id

    async def _link_repository_by_url(
        self, repository_url: str, integration_id: UUID | None, service_name: str, requester: UserDTO
    ) -> UUID:
        integration_id = await self._assert_git_integration(repository_url, integration_id)
        key = repository_key(repository_url)
        repo_name = (key or "").rsplit("/", 1)[-1]
        candidates = (
            (
                await self.crud.session.execute(
                    select(SourceCode).where(SourceCode.source_code_url.ilike(f"%{repo_name}%"))
                )
            )
            .scalars()
            .all()
        )
        source_code = next((c for c in candidates if repository_key(c.source_code_url) == key), None)

        if source_code is not None:
            if not source_code.default_branch and source_code.status in (
                ModelStatus.READY,
                ModelStatus.ERROR,
                ModelStatus.DONE,
            ):
                await self.source_code_service.patch_action(
                    source_code.id, PatchBodyModel(action=ModelActions.SYNC), requester
                )
            return source_code.id

        created = await self.source_code_service.create_source_code(
            SourceCodeCreate(
                description=f"Code of service {service_name}",
                source_code_url=repository_url,
                source_code_provider=repository_provider(repository_url),
                source_code_language="opentofu",
                integration_id=integration_id,
            ),
            requester=requester,
        )
        await self.source_code_service.patch_action(created.id, PatchBodyModel(action=ModelActions.SYNC), requester)
        return created.id

    async def create_service(self, service: ServiceCreate, requester: UserDTO) -> Service:
        if service.project_id:
            await self._assert_project_exists(service.project_id)
        if service.source_code_id and service.repository_url:
            raise ValueError("Give either a code repository or a repository URL, not both")

        body = to_json_serializable(
            service.model_dump(exclude_unset=True, exclude={"repository_url", "repository_integration_id"})
        )
        body["created_by"] = requester.id
        if body.get("source_code_id") == "":
            body["source_code_id"] = None
        if body.get("source_code_id"):
            await self._assert_source_code_exists(body["source_code_id"])
        if service.repository_url:
            source_code_id = await self._link_repository_by_url(
                service.repository_url, service.repository_integration_id, service.name, requester
            )
            body["source_code_id"] = str(source_code_id)

        new_service = await self.crud.create(body)
        result = await self.crud.get_by_id(new_service.id)

        if not result:
            raise EntityNotFound("Service not found after creation")

        await self.revision_handler.handle_revision(new_service)
        await self.audit_log_handler.create_log(
            new_service.id, requester.id, ModelActions.CREATE, revision_number=new_service.revision_number
        )
        response = ServiceResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return result

    async def update_service(self, service_id: str, service: ServiceUpdate, requester: UserDTO) -> Service:
        existing_service = await self.crud.get_by_id(service_id)

        if not existing_service:
            raise EntityNotFound("Service not found")

        body = model_db_dump(service, exclude_defaults=True, exclude_none=True)
        repository_url = body.pop("repository_url", None)
        repository_integration_id = body.pop("repository_integration_id", None)

        if repository_url == "":
            body["source_code_id"] = None
        elif repository_url:
            body["source_code_id"] = await self._link_repository_by_url(
                repository_url,
                UUID(str(repository_integration_id)) if repository_integration_id else None,
                existing_service.name,
                requester,
            )

        if not has_field_changes(body, existing_service):
            raise ValueError("No changes detected; the service is already up to date.")

        if body.get("project_id"):
            await self._assert_project_exists(body["project_id"])

        self.revision_handler.original_entity_instance_dump = to_dict(existing_service)

        await self.crud.update(existing_service, body)

        await self.revision_handler.handle_revision(existing_service)
        await self.audit_log_handler.create_log(
            existing_service.id,
            requester.id,
            ModelActions.UPDATE,
            revision_number=existing_service.revision_number,
        )
        await self.crud.refresh(existing_service)
        response = ServiceResponse.model_validate(existing_service)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return existing_service

    async def delete(self, service_id: str, requester: UserDTO) -> None:
        existing_service = await self.crud.get_by_id(service_id)
        if not existing_service:
            raise EntityNotFound("Service not found")

        await self.audit_log_handler.create_log(service_id, requester.id, ModelActions.DELETE)
        await self.subscription_service.delete_many_by_entity_id("service", service_id)
        await self.revision_handler.delete_revisions(service_id)
        await self.crud.delete(existing_service)

    async def get_actions(self, service_id: str | UUID, requester: UserDTO) -> list[str]:
        service = await self.crud.get_by_id(
            service_id,
            fields={"owners": {"id": None}, "project": {"id": None, "owners": {"id": None}}},
        )
        if not service:
            raise EntityNotFound("Service not found")

        return await get_service_actions(requester, service_id, service)

    async def create_service_policy(
        self,
        service_policy: EntityPolicyCreate,
        requester: UserDTO,
    ) -> list[Permission]:
        service = await self.crud.get_by_id(service_policy.entity_id)
        if not service:
            raise EntityNotFound(f"Service {service_policy.entity_id} not found")

        policy = await self.permission_service.create_entity_policy(
            service_policy,
            requester,
            reload_permission=False,
        )
        await self.permission_service.casbin_enforcer.send_reload_event()
        return [policy]

    async def create_service_subscription(
        self,
        service_id: str,
        requester: UserDTO,
        user_id: str | None = None,
    ) -> list[Subscription]:
        service = await self.get_by_id(service_id)
        if not service:
            raise EntityNotFound(f"Service {service_id} not found")

        target_user_id = user_id or str(requester.id)
        existing_subscriptions = await self.subscription_service.query_all(
            filter={"user_id": target_user_id, "entity_type": "service", "entity_id": [service_id]}
        )
        if existing_subscriptions:
            return existing_subscriptions

        subscription = await self.subscription_service.create(
            requester=requester,
            entity_type="service",
            entity_id=service_id,
            user_id=user_id,
        )
        return [subscription]

    async def delete_service_subscription(
        self,
        service_id: str,
        requester: UserDTO,
        user_id: str | None = None,
    ) -> bool:
        service = await self.get_by_id(service_id)
        if not service:
            raise EntityNotFound(f"Service {service_id} not found")

        target_user_id = user_id or str(requester.id)
        subscriptions = await self.subscription_service.query_all(
            filter={
                "user_id": target_user_id,
                "entity_type": "service",
                "entity_id": [service_id],
            }
        )

        for subscription in subscriptions:
            await self.subscription_service.delete(subscription_id=subscription.id)
        return True
