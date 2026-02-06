from collections.abc import AsyncGenerator
from fastapi import Depends

from application.source_codes.dependencies import get_source_code_service
from application.templates.dependencies import get_template_service
from application.validation_rules.crud import ValidationRuleCRUD
from application.validation_rules.service import ValidationRuleService
from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.logs.dependencies import get_log_service
from core.revisions.handler import RevisionHandler
from core.tasks.dependencies import get_task_service
from core.utils.event_sender import EventSender

from .crud import SourceCodeVersionCRUD
from .service import SourceCodeVersionService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_source_code_version_service(
    session: AsyncSession = Depends(get_db_session),
) -> SourceCodeVersionService:
    revision_handler = RevisionHandler(session=session, entity_name="source_code_version")
    event_sender = EventSender(entity_name="source_code_version")
    audit_log_handler = AuditLogHandler(session=session, entity_name="source_code_version")
    template_service = get_template_service(session=session)
    return SourceCodeVersionService(
        crud=SourceCodeVersionCRUD(session=session),
        template_service=template_service,
        source_code_service=get_source_code_service(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
        log_service=get_log_service(session=session),
        task_service=get_task_service(session=session),
        validation_rule_service=ValidationRuleService(
            crud=ValidationRuleCRUD(session=session),
            template_service=template_service,
        ),
    )
