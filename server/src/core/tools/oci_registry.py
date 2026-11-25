import logging
import re
from urllib.parse import urlsplit

import httpx

logger = logging.getLogger(__name__)

MANIFEST_MEDIA_TYPES = ", ".join(
    [
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    ]
)

_CHALLENGE_PARAM = re.compile(r'(\w+)="([^"]*)"')


async def _registry_request(
    method: str, registry_host: str, username: str, password: str, repository: str, path: str, headers: dict[str, str]
) -> httpx.Response | None:
    """Call the OCI distribution API for a repository; None when a token registry denies access to it.

    Registries either accept Basic auth directly (ECR) or answer 401 with a Bearer challenge, whose token
    endpoint takes the same credentials (Docker Hub, GHCR, ACR, Harbor).
    """
    url = f"https://{registry_host}/v2/{repository}/{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.request(method, url, headers=headers, auth=(username, password))
        challenge = response.headers.get("www-authenticate", "")
        if response.status_code == 401 and challenge.lower().startswith("bearer "):
            params = dict(_CHALLENGE_PARAM.findall(challenge))
            realm = params.pop("realm", "")
            if not realm:
                raise ValueError(f"{registry_host} sent a Bearer challenge without a realm")
            if urlsplit(realm).scheme != "https":
                raise ValueError(f"{registry_host} sent a token endpoint that isn't HTTPS: {realm}")
            params.setdefault("scope", f"repository:{repository}:pull")
            token_response = await client.get(realm, params=params, auth=(username, password))
            _ = token_response.raise_for_status()
            body = token_response.json()
            token = body.get("token") or body.get("access_token")
            if not token:
                raise ValueError(f"{realm} returned no token")
            response = await client.request(method, url, headers={**headers, "Authorization": f"Bearer {token}"})
            # Token registries deny a scope on a repository that doesn't exist yet instead of answering 404
            if response.status_code in (401, 403):
                return None
    return response


async def manifest_exists(registry_host: str, username: str, password: str, repository: str, reference: str) -> bool:
    """Whether the registry has a manifest for repository:reference."""
    response = await _registry_request(
        "HEAD",
        registry_host,
        username,
        password,
        repository,
        f"manifests/{reference}",
        {"Accept": MANIFEST_MEDIA_TYPES},
    )
    if response is None:
        logger.warning(f"{registry_host} denied reading {repository}:{reference}; assuming it isn't pushed")
        return False
    if response.status_code == 404:
        return False
    _ = response.raise_for_status()
    return True


async def repository_exists(registry_host: str, username: str, password: str, repository: str) -> bool | None:
    """Whether the repository exists; None when the registry doesn't tell, e.g. token registries that create
    repositories on the first push."""
    response = await _registry_request("GET", registry_host, username, password, repository, "tags/list", {})
    if response is None:
        return None
    if response.status_code == 404:
        return False
    _ = response.raise_for_status()
    return True
