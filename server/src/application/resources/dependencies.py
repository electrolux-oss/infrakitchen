from collections.abc import AsyncGenerator
from fastapi import Depends

from application.integrations.dependencies import get_integration_service
from application.source_code_versions.dependencies import get_source_code_version_service
from application.storages.dependencies import get_storage_service
from application.templates.dependencies import get_template_service
from application.resource_temp_state.handler import ResourceTempStateHandler
from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.logs.dependencies import get_log_service
from core.permissions.dependencies import get_permission_service
from core.revisions.handler import RevisionHandler
from core.tasks.dependencies import get_task_service
from core.utils.event_sender import EventSender
from application.validation_rules.dependencies import get_validation_rule_service

from .crud import ResourceCRUD
from .service import ResourceService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_resource_service(
    session: AsyncSession = Depends(get_db_session),
) -> ResourceService:
    revision_handler = RevisionHandler(session=session, entity_name="resource")
    event_sender = EventSender(entity_name="resource")
    workspace_event_sender = EventSender(entity_name="workspace")
    audit_log_handler = AuditLogHandler(session=session, entity_name="resource")
    resource_temp_state_handler = ResourceTempStateHandler(session=session)
    return ResourceService(
        crud=ResourceCRUD(session=session),
        template_service=get_template_service(session=session),
        integration_service=get_integration_service(session=session),
        permission_service=get_permission_service(session=session),
        service_source_code_version=get_source_code_version_service(session=session),
        storage_service=get_storage_service(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        workspace_event_sender=workspace_event_sender,
        audit_log_handler=audit_log_handler,
        resource_temp_state_handler=resource_temp_state_handler,
        log_service=get_log_service(session=session),
        task_service=get_task_service(session=session),
        validation_rule_service=get_validation_rule_service(session=session),
    )
