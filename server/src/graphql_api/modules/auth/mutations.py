import datetime

import strawberry
from strawberry.types import Info

from core.errors import AccessUnauthorized
from core.sso.github import github_refresh_token
from core.sso.guest import guest_refresh_token
from core.sso.microsoft import microsoft_refresh_token
from core.sso.service import SSOService
from graphql_api.modules.auth.types import LogoutResponseType, RefreshAuthTokenType


def _make_refresh_response(result: dict[str, str | datetime.datetime], provider: str) -> RefreshAuthTokenType:
    return RefreshAuthTokenType(
        token=str(result["token"]),
        expiration=str(result["expiration"]),
        provider=provider,
    )


@strawberry.type
class AuthMutation:
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

        raise AccessUnauthorized("Authentication failed")

    @strawberry.mutation
    async def logout(self, info: Info) -> LogoutResponseType:
        response = info.context["response"]

        cookie_names = ["microsoft-refresh-token", "guest-token", "github-refresh-token", "token"]
        for cookie_name in cookie_names:
            response.delete_cookie(key=cookie_name, httponly=True, secure=True)

        return LogoutResponseType(success=True)
