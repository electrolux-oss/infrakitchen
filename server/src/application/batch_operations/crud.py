from typing import Any
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.users.model import User
from core.utils.model_tools import is_valid_uuid

from .model import BatchOperation


class BatchOperationCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, batch_operation_id: str | UUID) -> BatchOperation | None:
        if not is_valid_uuid(batch_operation_id):
            raise ValueError(f"Invalid UUID: {batch_operation_id}")

        statement = select(BatchOperation).where(BatchOperation.id == batch_operation_id)
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[BatchOperation]:
        statement = select(BatchOperation).join(User, BatchOperation.created_by == User.id)
        statement = evaluate_sqlalchemy_sorting(BatchOperation, statement, sort)
        statement = evaluate_sqlalchemy_filters(BatchOperation, statement, filter)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(BatchOperation)
        statement = evaluate_sqlalchemy_filters(BatchOperation, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> BatchOperation:
        batch_operation = BatchOperation(**body)
        self.session.add(batch_operation)
        await self.session.flush()
        await self.session.refresh(batch_operation)
        return batch_operation

    async def update(self, batch_operation: BatchOperation) -> BatchOperation:
        await self.session.flush()
        await self.session.refresh(batch_operation)
        return batch_operation

    async def delete(self, batch_operation_id: str | UUID) -> None:
        batch_operation = await self.get_by_id(batch_operation_id)
        if batch_operation:
            await self.session.delete(batch_operation)
            await self.session.flush()
