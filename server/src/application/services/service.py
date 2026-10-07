import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select

from application.projects.model import Project
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
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
    ):
        self.crud: ServiceCRUD = crud
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

    async def create_service(self, service: ServiceCreate, requester: UserDTO) -> Service:
        await self._assert_project_exists(service.project_id)

        body = to_json_serializable(service.model_dump(exclude_unset=True))
        body["created_by"] = requester.id
        if body.get("repository_url") == "":
            body["repository_url"] = None

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
        if body.get("repository_url") == "":
            body["repository_url"] = None

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
