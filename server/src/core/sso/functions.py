from datetime import datetime
import json
import logging
import re
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
from jwt.algorithms import ECAlgorithm

from core.casbin.enforcer import CasbinEnforcer
from core.config import Settings
from core.errors import EntityExistsError
from core.sso.dependencies import get_sso_service
from core.sso.service import SSOService
from core.users.functions import user_has_access_to_api
from core.users.schema import UserCreateWithProvider, UserResponse
from core.utils.json_encoder import JsonEncoder

from ..auth_providers import BackstageProviderConfig
from ..users import UserDTO

logger = logging.getLogger(__name__)

request_action_mapping = {
    "GET": ["read", "write", "admin"],
    "POST": ["write", "admin"],
    "PUT": ["write", "admin"],
    "PATCH": ["write", "admin"],
    "DELETE": ["write", "admin"],
}


async def check_api_permission(request: Request):
    if request.url.path == "/auth/me":
        return

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    if casbin_enforcer.enforcer is None:
        raise HTTPException(status_code=500, detail="Casbin enforcer is not initialized")

    user: UserDTO | None = request.state.user
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if user.deactivated is True:
        raise HTTPException(status_code=403, detail="Forbidden. User is deactivated")

    match = re.search(r"/api/([^/?]+)", request.url.path)
    if match:
        entity = match.group(1).removesuffix("s")  # singular form
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    if entity == "resource" or entity == "resource_temp_state" or entity == "executor":
        # resources has own permission control system `user_has_access_to_entity` function
        if await user_has_access_to_api(user, "resource", "read"):
            return

        if await user_has_access_to_api(user, "executor", "read"):
            return

    if request.method not in request_action_mapping:
        raise HTTPException(status_code=403, detail=f"{request.method} method is forbidden for {entity}")

    for method in request_action_mapping[request.method]:
        if await user_has_access_to_api(user, entity, method):
            return

    raise HTTPException(status_code=403, detail=f"{request.method} method is forbidden")


async def get_jwks(jwks_url) -> list[dict[str, Any]]:
    """
    Fetch JWT keys from public endpoint
    """
    if jwks_url:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url)
            resp_json = response.json()
            return resp_json["keys"] if response.status_code == 200 else []
    else:
        return []


def validate_token(token: str, alg: str, audience: str) -> dict[str, Any]:
    JWT_KEY = Settings().JWT_KEY
    assert JWT_KEY is not None, "JWT_KEY is not set"
    try:
        return jwt.decode(token, key=JWT_KEY, algorithms=[alg], audience=audience)
    except Exception as error:
        logger.error(f"Error decoding token: {error}")
        raise HTTPException(status_code=401, detail=f"Invalid authentication credentials. {error}") from error


async def get_decoded_token(
    service: SSOService, token: str, alg: str, token_type: str, audience: str
) -> dict[str, Any]:
    """
    Decodes and validates a JWT token based on its type.

    Args:
        token (str): The JWT token to decode
        alg (str): The algorithm used to sign the token (e.g. 'HS256')
        token_type (str): Type of token - either 'infrakitchen.auth.token' or 'vnd.backstage.user'
        audience (str): Expected audience claim for token validation

    Returns:
        dict: Decoded token claims

    Raises:
        HTTPException:
            - 401 if token decoding fails
            - 401 if token validation fails
        NotImplementedError: If token_type is not supported

    Notes:
        - For 'infrakitchen.auth.token': Validates signature using JWT_KEY
        - For 'vnd.backstage.user': Decodes without signature verification
    """
    if token_type == "infrakitchen.auth.token":
        return validate_token(token, alg, audience)

    elif token_type == "vnd.backstage.user":
        backstage_providers = await service.auth_provider_service.get_all(filter={"auth_provider": "backstage"})
        if len(backstage_providers) == 0 or backstage_providers[0].enabled is False:
            raise HTTPException(status_code=401, detail="Backstage authentication provider is not enabled")
        backstage_provider = backstage_providers[0]

        assert isinstance(backstage_provider.configuration, BackstageProviderConfig)
        jwks_url = backstage_provider.configuration.backstage_jwks_url
        jwks_keys = await get_jwks(jwks_url)
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise jwt.exceptions.InvalidKeyError("JWKS can not be applied while key does not have kid")

        public_keys = {}
        for jwk in jwks_keys:
            jkid = jwk["kid"]
            public_keys[jkid] = ECAlgorithm(ECAlgorithm.SHA256).from_jwk(jwk)
        key = public_keys[kid]
        try:
            return jwt.decode(token, algorithms=[alg], key=key, audience=audience)  # type: ignore [arg-type]
        except Exception as error:
            logger.error(f"Error decoding token: {error}")
            raise HTTPException(status_code=401, detail=f"Invalid authentication credentials. {error}") from error
    else:
        raise NotImplementedError(f"Invalid token type: {token_type}")


async def get_user_from_token(service: SSOService, token: str | None = Security(APIKeyCookie(name="token"))):
    """
    Validates and decodes a JWT token to retrieve user information.

    Args:
        token (str | None): JWT token. Defaults to getting from 'token' cookie via Security.

    Returns:
        UserModel: User object containing user details

    Raises:
        HTTPException:
            - 401 if token is missing or invalid
            - 401 if token validation/decoding fails
            - 401 if user ID cannot be extracted from claims

    Flow:
        1. Validates token presence
        2. Extracts token headers (alg, type) and audience
        3. Decodes token based on type:
            - infrakitchen.auth.token: Validates signature and gets user from ID in payload
            - vnd.backstage.user: Creates/gets user based on subject claim
    """
    if token is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    try:
        # get audience of token to choose the right validation
        token_headers = jwt.get_unverified_header(token)
        alg = token_headers["alg"]
        token_type = token_headers["typ"]
        decoded_token: dict[str, Any] = jwt.decode(token, algorithms=[alg], options={"verify_signature": False})
        audience = decoded_token.get("aud", "")
    except Exception as error:
        logger.error(f"Error decoding token: {error}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials") from error

    try:
        claims = await get_decoded_token(service, token, alg, token_type, audience)
        if token_type == "infrakitchen.auth.token":
            user_id = claims.get("pld", {}).get("id")
            assert user_id is not None, "User ID not found in token claims"
            # trusting JWT token, so no need to check if user exists in database
            user = UserDTO.model_validate(claims["pld"])
            return user
        elif token_type == "vnd.backstage.user":
            user_id = claims.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid authentication credentials")

            user = await service.user_service.create_user_if_not_exists(
                UserCreateWithProvider(identifier=user_id, provider="backstage")
            )

            try:
                _ = await service.permission_service.assign_user_to_role("default", user.id)
            except EntityExistsError:
                pass  # User is already assigned to the role

            return user
    except Exception as error:
        logger.error(f"Error decoding token: {error}")
        raise HTTPException(status_code=401, detail=f"Invalid authentication credentials. {error}") from error


async def get_logged_user(
    request: Request,
    token: HTTPAuthorizationCredentials | None = Security(HTTPBearer()),
    service: SSOService = Depends(get_sso_service),
) -> UserResponse | UserDTO:
    """Get user's JWT stored in cookie 'token', parse it and return the user's OpenID."""
    if not token:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user = await get_user_from_token(service, token.credentials)
    request.state.user = user
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return user


def create_user_token(user: UserDTO, expiration: datetime) -> str:
    JWT_KEY = Settings().JWT_KEY
    if not JWT_KEY:
        raise ValueError("JWT_KEY is not set")

    if user.deactivated is True:
        raise ValueError("User is deactivated")

    dumped_user = user.model_dump()
    dumped_user.pop("password", None)

    token = jwt.encode(
        {
            "pld": json.loads(json.dumps(dumped_user, cls=JsonEncoder)),
            "exp": expiration,
            "sub": str(user.id),
            "aud": "infrakitchen",
        },
        key=JWT_KEY,
        algorithm="HS256",
        headers={"typ": "infrakitchen.auth.token", "alg": "HS256"},
    )
    return token
