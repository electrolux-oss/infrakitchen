from collections.abc import AsyncGenerator
from fastapi import Depends

from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_codes.dependencies import get_source_code_service
from application.templates.dependencies import get_template_service
from application.use_cases.create_template_with_scv.service import TemplateWithSCVService
from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender


from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_template_with_scv_service(
    session: AsyncSession = Depends(get_db_session),
) -> TemplateWithSCVService:
    revision_handler = RevisionHandler(session=session, entity_name="template")
    source_code_event_sender = EventSender(entity_name="source_code")
    source_code_version_event_sender = EventSender(entity_name="source_code_version")
    audit_log_handler = AuditLogHandler(session=session, entity_name="template")
    return TemplateWithSCVService(
        template_service=get_template_service(session=session),
        source_code_service=get_source_code_service(session=session),
        source_code_version_service=get_source_code_version_service(session=session),
        revision_handler=revision_handler,
        source_code_event_sender=source_code_event_sender,
        source_code_version_event_sender=source_code_version_event_sender,
        audit_log_handler=audit_log_handler,
    )
