import datetime

import httpx
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error, InvalidGrantError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from fastapi_sso.sso.github import GithubSSO

from core.config import Settings
from core.sso.service import SSOService
from core.users.schema import UserCreateWithProvider


from .functions import create_user_token

from ..auth_providers import GithubProviderConfig
from .dependencies import get_sso_service

router = APIRouter()


async def get_github_sso(service: SSOService) -> GithubSSO:
    github_providers = await service.auth_provider_service.get_all(filter={"auth_provider": "github"})
    if len(github_providers) == 0 or not github_providers[0].enabled:
        raise HTTPException(status_code=401, detail="Github login is disabled")

    github_provider = github_providers[0]

    assert isinstance(github_provider.configuration, GithubProviderConfig)

    GITHUB_CLIENT_ID = github_provider.configuration.client_id
    GITHUB_CLIENT_SECRET = github_provider.configuration.client_secret.get_decrypted_value()
    GITHUB_REDIRECT_URI = github_provider.configuration.redirect_uri

    if not (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET and GITHUB_REDIRECT_URI):
        raise ValueError("Github SSO not configured")

    return GithubSSO(
        client_id=GITHUB_CLIENT_ID,
        client_secret=GITHUB_CLIENT_SECRET,
        redirect_uri=GITHUB_REDIRECT_URI,
        allow_insecure_http=True,
        scope=["user:email", "read:user", "repo", "read:org"],
    )


@router.get("/github/login")
async def github_login(service: SSOService = Depends(get_sso_service)):
    github_sso = await get_github_sso(service)
    return await github_sso.get_login_redirect()


async def github_refresh_token(
    service: SSOService,
    request: Request,
    response: Response,
    cookie: str | None = None,
):
    async def get_user_email(access_token):
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            assert resp.status_code == 200, "Failed to fetch user emails, grant access to Github App"
            emails = resp.json()
            for email in emails:
                if email["primary"]:
                    return email["email"]

    github_sso = await get_github_sso(service)

    token_endpoint = await github_sso.token_endpoint
    if not token_endpoint:
        raise HTTPException(status_code=500, detail="token_endpoint is not defined")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_endpoint,
            data={
                "grant_type": "refresh_token",
                "client_id": github_sso.client_id,
                "client_secret": github_sso.client_secret,
                "refresh_token": cookie,
            },
            headers={"Accept": "application/json"},
        )

        resp_json = resp.json()

    if resp_json.get("error"):
        raise HTTPException(status_code=401, detail=resp_json.get("error_description"))

    if "access_token" not in resp_json:
        raise HTTPException(status_code=401, detail="Authentication failed")

    # email is identifier for github auth
    email = await get_user_email(resp_json["access_token"])
    if not email:
        raise HTTPException(status_code=401, detail="Authentication failed")

    expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=int(Settings().SESSION_EXPIRATION))

    user = await service.user_service.get_user_by_identifier(email)

    if not user:
        raise HTTPException(status_code=401, detail="Authentication failed")

    token = create_user_token(user, expiration)

    if "refresh_token" in resp_json:
        response.set_cookie(
            key="github-refresh-token",
            value=resp_json["refresh_token"],
            httponly=True,
            secure=True,
            expires=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30),
        )

    return {"token": token, "expiration": expiration}


@router.get("/github/callback")
async def github_callback(request: Request, service: SSOService = Depends(get_sso_service)):
    github_sso = await get_github_sso(service)
    try:
        openid = await github_sso.verify_and_process(request)
    except InvalidGrantError as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed. {e}") from e
    except CustomOAuth2Error as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed. {e}") from e

    if not openid:
        raise HTTPException(status_code=401, detail="Authentication failed")

    github_providers = await service.auth_provider_service.get_all(filter={"auth_provider": "github"})
    if len(github_providers) == 0 or not github_providers[0].enabled:
        raise HTTPException(status_code=401, detail="Github login is disabled")

    github_provider = github_providers[0]

    user_from_provider = openid.model_dump()
    if user_from_provider.get("id"):
        del user_from_provider["id"]

    if not user_from_provider.get("email"):
        raise HTTPException(status_code=401, detail="Authentication failed. Email attribute is required")

    user_from_provider["email"] = user_from_provider["email"].lower()
    user_from_provider["identifier"] = user_from_provider["email"]
    if len(github_provider.filter_by_domain) > 0:
        if not any(user_from_provider["email"].endswith(f"@{domain}") for domain in github_provider.filter_by_domain):
            raise HTTPException(status_code=401, detail="Authentication failed")

    assert github_sso.refresh_token is not None, "Refresh token is required. Check your app configuration."

    user = await service.user_service.create_user_if_not_exists(
        UserCreateWithProvider.model_validate(user_from_provider)
    )
    _ = await service.casbin_enforcer.add_casbin_user_role(user.id, "default")

    response = RedirectResponse(url="/")
    response.set_cookie(
        key="github-refresh-token",
        value=github_sso.refresh_token,
        httponly=True,
        secure=True,
        expires=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30),
    )  # This cookie will make sure the user is authenticated
    assert user.id is not None, "User ID should not be None after saving the user"
    await service.audit_log_handler.create_log(
        entity_id=user.id,
        requester_id=user.id,
        action="login",
    )
    return response
