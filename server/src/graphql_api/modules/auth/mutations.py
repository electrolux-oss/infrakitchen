import datetime

import strawberry
from strawberry.types import Info

from core.errors import AccessUnauthorized
from core.sso.github import github_refresh_token
from core.sso.google import google_refresh_token
from core.sso.guest import guest_refresh_token
from core.sso.microsoft import microsoft_refresh_token
from core.sso.service import SSOService
from core.sso.functions import create_user_token
from core.utils.password_manager import is_correct_password
from graphql_api.modules.auth.types import LogoutResponseType, RefreshAuthTokenType, ServiceAccountTokenType


def _make_refresh_response(result: dict[str, str | datetime.datetime], provider: str) -> RefreshAuthTokenType:
    return RefreshAuthTokenType(
        token=str(result["token"]),
        expiration=str(result["expiration"]),
        provider=provider,
    )


@strawberry.type
class AuthMutation:
    @strawberry.mutation
    async def service_account_token(self, info: Info, identifier: str, password: str) -> ServiceAccountTokenType:
        service: SSOService = info.context["sso_service"]

        ik_sa_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "ik_service_account"})
        if len(ik_sa_provider) == 0 or not ik_sa_provider[0].enabled:
            raise AccessUnauthorized("Service Account login is disabled")

        if not identifier or not password:
            raise ValueError("identifier and password are required")

        user = await service.user_service.get_user_by_identifier(identifier)

        if not user or not user.password:
            raise AccessUnauthorized("Invalid password or username")

        salt, hashed_password = user.password.get_decrypted_value().split("$", maxsplit=1)
        if not is_correct_password(salt, hashed_password, password):
            raise AccessUnauthorized("Invalid password or username")

        expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30)
        token = create_user_token(user, expiration)

        return ServiceAccountTokenType(token=token, expires_at=str(expiration))

    @strawberry.mutation
    async def refresh_auth_token(self, info: Info) -> RefreshAuthTokenType:
        request = info.context["request"]
        response = info.context["response"]
        service: SSOService = info.context["sso_service"]

        microsoft_token = request.cookies.get("microsoft-refresh-token")
        if microsoft_token:
            result = await microsoft_refresh_token(service, request, response, cookie=microsoft_token)
            return _make_refresh_response(result, "microsoft")

        guest_token = request.cookies.get("guest-token")
        if guest_token:
            result = await guest_refresh_token(service, request, response, cookie=guest_token)
            return _make_refresh_response(result, "guest")

        github_token = request.cookies.get("github-refresh-token")
        if github_token:
            result = await github_refresh_token(service, request, response, cookie=github_token)
            return _make_refresh_response(result, "github")

        google_token = request.cookies.get("google-refresh-token")
        if google_token:
            result = await google_refresh_token(service, request, response, cookie=google_token)
            return _make_refresh_response(result, "google")

        raise AccessUnauthorized("Authentication failed")

    @strawberry.mutation
    async def logout(self, info: Info) -> LogoutResponseType:
        response = info.context["response"]

        cookie_names = [
            "microsoft-refresh-token",
            "guest-token",
            "github-refresh-token",
            "google-refresh-token",
            "token",
        ]
        for cookie_name in cookie_names:
            response.delete_cookie(key=cookie_name, httponly=True, secure=True)

        return LogoutResponseType(success=True)
