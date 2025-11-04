from collections.abc import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import SessionLocal
from .crud import LabelsCRUD
from .service import LabelsService


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_labels_crud(session: AsyncSession = Depends(get_db_session)) -> LabelsCRUD:
    return LabelsCRUD(session)


def get_labels_service(crud: LabelsCRUD = Depends(get_labels_crud)) -> LabelsService:
    return LabelsService(crud)
