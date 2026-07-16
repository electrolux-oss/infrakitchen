from core.audit_logs.handler import AuditLogHandler
from core.auth_providers.service import AuthProviderService
from core.casbin.enforcer import CasbinEnforcer
from core.personal_access_tokens.service import PersonalAccessTokenService

from core.permissions.service import PermissionService
from core.users.service import UserService


class SSOService:
    def __init__(
        self,
        user_service: UserService,
        auth_provider_service: AuthProviderService,
        audit_log_handler: AuditLogHandler,
        permission_service: PermissionService,
        casbin_enforcer: CasbinEnforcer,
        personal_access_token_service: PersonalAccessTokenService,
    ):
        self.user_service: UserService = user_service
        self.auth_provider_service: AuthProviderService = auth_provider_service
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.casbin_enforcer: CasbinEnforcer = casbin_enforcer
        self.permission_service: PermissionService = permission_service
        self.personal_access_token_service: PersonalAccessTokenService = personal_access_token_service
