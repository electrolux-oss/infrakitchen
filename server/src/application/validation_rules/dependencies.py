from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import SessionLocal

from .crud import ValidationRuleCRUD
from .service import ValidationRuleService


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_validation_rule_service(
    session: AsyncSession = Depends(get_db_session),
) -> ValidationRuleService:
    return ValidationRuleService(crud=ValidationRuleCRUD(session=session))
