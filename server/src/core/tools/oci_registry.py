import re

import httpx

MANIFEST_MEDIA_TYPES = ", ".join(
    [
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    ]
)

_CHALLENGE_PARAM = re.compile(r'(\w+)="([^"]*)"')


async def manifest_exists(registry_host: str, username: str, password: str, repository: str, reference: str) -> bool:
    """Whether the registry has a manifest for repository:reference, through the OCI distribution API.

    Registries either accept Basic auth directly (ECR) or answer 401 with a Bearer challenge, whose token
    endpoint takes the same credentials (Docker Hub, GHCR, ACR, Harbor).
    """
    url = f"https://{registry_host}/v2/{repository}/manifests/{reference}"
    headers = {"Accept": MANIFEST_MEDIA_TYPES}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.head(url, headers=headers, auth=(username, password))
        challenge = response.headers.get("www-authenticate", "")
        if response.status_code == 401 and challenge.lower().startswith("bearer "):
            params = dict(_CHALLENGE_PARAM.findall(challenge))
            realm = params.pop("realm", "")
            if not realm:
                raise ValueError(f"{registry_host} sent a Bearer challenge without a realm")
            params.setdefault("scope", f"repository:{repository}:pull")
            token_response = await client.get(realm, params=params, auth=(username, password))
            _ = token_response.raise_for_status()
            body = token_response.json()
            token = body.get("token") or body.get("access_token")
            if not token:
                raise ValueError(f"{realm} returned no token")
            response = await client.head(url, headers={**headers, "Authorization": f"Bearer {token}"})

    if response.status_code == 404:
        return False
    _ = response.raise_for_status()
    return True
