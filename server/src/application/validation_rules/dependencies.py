from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session

from .crud import ValidationRuleCRUD
from .service import ValidationRuleService


def get_validation_rule_service(
    session: AsyncSession = Depends(get_db_session),
) -> ValidationRuleService:
    return ValidationRuleService(crud=ValidationRuleCRUD(session=session))
