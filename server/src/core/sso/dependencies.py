from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.audit_logs.handler import AuditLogHandler
from core.auth_providers.dependencies import get_auth_provider_service
from core.casbin.enforcer import CasbinEnforcer
from core.database import SessionLocal

from core.sso.service import SSOService
from core.users.dependencies import get_user_service
from core.permissions.dependencies import get_permission_service


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_sso_service(
    session: AsyncSession = Depends(get_db_session),
) -> SSOService:
    audit_log_handler = AuditLogHandler(session=session, entity_name="user")
    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = casbin_enforcer.get_enforcer()

    return SSOService(
        user_service=get_user_service(session=session),
        auth_provider_service=get_auth_provider_service(session=session),
        audit_log_handler=audit_log_handler,
        permission_service=get_permission_service(session=session),
        casbin_enforcer=casbin_enforcer,
    )
