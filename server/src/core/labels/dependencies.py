from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.dependencies import get_db_session
from .crud import LabelsCRUD
from .service import LabelsService


def get_labels_crud(session: AsyncSession = Depends(get_db_session)) -> LabelsCRUD:
    return LabelsCRUD(session)


def get_labels_service(crud: LabelsCRUD = Depends(get_labels_crud)) -> LabelsService:
    return LabelsService(crud)
