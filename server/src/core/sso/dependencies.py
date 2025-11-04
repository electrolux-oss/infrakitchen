from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.audit_logs.handler import AuditLogHandler
from core.auth_providers.crud import AuthProviderCRUD
from core.auth_providers.service import AuthProviderService
from core.casbin.enforcer import CasbinEnforcer
from core.database import SessionLocal
from core.sso.service import SSOService
from core.users.crud import UserCRUD
from core.users.service import UserService
from core.utils.event_sender import EventSender


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_sso_service(
    session: AsyncSession = Depends(get_db_session),
) -> SSOService:
    audit_log_handler = AuditLogHandler(session=session, entity_name="user")
    event_sender = EventSender(entity_name="user")
    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = casbin_enforcer.get_enforcer()

    return SSOService(
        user_service=UserService(
            crud=UserCRUD(session=session),
            audit_log_handler=audit_log_handler,
        ),
        auth_provider_service=AuthProviderService(
            crud=AuthProviderCRUD(session=session),
            audit_log_handler=audit_log_handler,
            event_sender=event_sender,
        ),
        audit_log_handler=audit_log_handler,
        casbin_enforcer=casbin_enforcer,
    )
