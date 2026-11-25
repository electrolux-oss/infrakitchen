from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.users.model import User
from core.utils.model_tools import is_valid_uuid

from .model import Service, ServiceRegistry
from .query_options import build_service_query_options


class ServiceCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        service_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> Service | None:
        if not is_valid_uuid(service_id):
            raise ValueError(f"Invalid UUID: {service_id}")

        statement = select(Service).where(Service.id == service_id)
        statement = statement.options(*build_service_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalars().unique().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Service]:
        statement = select(Service)
        statement = evaluate_sqlalchemy_filters(Service, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Service, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(*build_service_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Service)
        statement = evaluate_sqlalchemy_filters(Service, statement, filter)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def _resolve_users(self, user_ids: list[Any]) -> list[User]:
        result = await self.session.execute(select(User).where(User.id.in_(user_ids)))
        users = list(result.scalars().all())
        if len(users) != len(set(str(user_id) for user_id in user_ids)):
            raise ValueError("Some owner ids were not found")
        return users

    async def create(self, body: dict[str, Any]) -> Service:
        owner_ids = body.pop("owners", [])
        db_service = Service(**body)

        if owner_ids:
            db_service.owners = await self._resolve_users(owner_ids)

        self.session.add(db_service)
        await self.session.flush()
        return db_service

    async def update(self, existing_service: Service, body: dict[str, Any]) -> Service:
        for key, value in body.items():
            if key != "owners" and hasattr(existing_service, key):
                setattr(existing_service, key, value)

        if body.get("owners") == []:
            existing_service.owners = []
        elif body.get("owners"):
            existing_service.owners = await self._resolve_users(body.pop("owners"))

        return existing_service

    async def add_registry(self, service: Service, body: dict[str, Any]) -> ServiceRegistry:
        registry = ServiceRegistry(**body)
        service.registries.append(registry)
        await self.session.flush()
        return registry

    async def remove_registry(self, service: Service, registry: ServiceRegistry) -> None:
        service.registries.remove(registry)
        await self.session.flush()

    async def add_base_image_registry(self, service: Service, integration_id: str | UUID) -> None:
        integration = await self.session.get(Integration, integration_id)
        if integration is None:
            raise ValueError(f"Integration {integration_id} not found")
        service.base_image_registries.append(integration)
        await self.session.flush()

    async def delete(self, service: Service) -> None:
        await self.session.delete(service)

    async def refresh(self, service: Service) -> None:
        await self.session.refresh(service)
