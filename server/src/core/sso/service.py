from core.audit_logs.handler import AuditLogHandler
from core.auth_providers.service import AuthProviderService
from core.casbin.enforcer import CasbinEnforcer
from core.users.service import UserService


class SSOService:
    """
    SourceCodeService implements all required business-logic. It uses additional services and utils as helpers
    e.g. SourceCodeCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        user_service: UserService,
        auth_provider_service: AuthProviderService,
        audit_log_handler: AuditLogHandler,
        casbin_enforcer: CasbinEnforcer,
    ):
        self.user_service: UserService = user_service
        self.auth_provider_service: AuthProviderService = auth_provider_service
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.casbin_enforcer: CasbinEnforcer = casbin_enforcer
