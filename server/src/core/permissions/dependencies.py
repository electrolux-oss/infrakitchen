from collections.abc import AsyncGenerator
from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.casbin.enforcer import CasbinEnforcer
from core.database import SessionLocal
from core.revisions.handler import RevisionHandler
from core.users.crud import UserCRUD
from core.users.service import UserService

from .crud import PermissionCRUD
from .service import PermissionService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_permission_service(
    session: AsyncSession = Depends(get_db_session),
) -> PermissionService:
    revision_handler = RevisionHandler(session=session, entity_name="permission")
    audit_log_handler = AuditLogHandler(session=session, entity_name="permission")
    casbin_enforcer = CasbinEnforcer()
    return PermissionService(
        crud=PermissionCRUD(session=session),
        revision_handler=revision_handler,
        audit_log_handler=audit_log_handler,
        casbin_enforcer=casbin_enforcer,
        user_service=UserService(
            crud=UserCRUD(session=session),
            audit_log_handler=audit_log_handler,
        ),
    )
