from typing import Any
from uuid import UUID

from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.resources.model import Resource
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import Storage


class StorageCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, storage_id: str | UUID) -> Storage | None:
        if not is_valid_uuid(storage_id):
            raise ValueError(f"Invalid UUID: {storage_id}")

        statement = (select(Storage).where(Storage.id == storage_id).join(User, Storage.created_by == User.id)).join(
            Integration, Storage.integration_id == Integration.id
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Storage]:
        statement = (
            select(Storage)
            .join(User, Storage.created_by == User.id)
            .join(Integration, Storage.integration_id == Integration.id)
        )
        statement = evaluate_sqlalchemy_filters(Storage, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Storage, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Storage)
        statement = evaluate_sqlalchemy_filters(Storage, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Storage:
        db_storage = Storage(**body)
        self.session.add(db_storage)
        await self.session.flush()
        return db_storage

    async def update(self, existing_storage: Storage, body: dict[str, Any]) -> Storage:
        for key, value in body.items():
            setattr(existing_storage, key, value)

        return existing_storage

    async def delete(self, storage: Storage) -> None:
        await self.session.delete(storage)

    async def get_dependencies(self, existing_storage: Storage) -> list[Any]:
        statement = select(
            Resource.id.label("id"), literal("resource").label("type"), Resource.name.label("name")
        ).where(Resource.storage_id == existing_storage.id)
        result = await self.session.execute(statement)
        return list(result.fetchall())

    async def refresh(self, storage: Storage) -> None:
        await self.session.refresh(storage)
