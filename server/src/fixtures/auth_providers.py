from typing import Any, Literal, TypedDict

from core.auth_providers.dependencies import get_auth_provider_service
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_providers.schema import AuthProviderCreate
from core.users.model import UserDTO


class ProviderFixture(TypedDict):
    """Fixture definition for auth providers."""

    auth_provider: Literal["microsoft", "guest", "github", "backstage", "ik_service_account"]
    name: str
    enabled: bool
    filter_by_domain: list[str]
    configuration: Any
    description: str


async def create_auth_provider(session: AsyncSession, user: UserDTO):
    auth_provider_service = get_auth_provider_service(session=session)
    provider_fixtures: list[ProviderFixture] = [
        {
            "auth_provider": "github",
            "name": "GitHub",
            "enabled": False,
            "filter_by_domain": ["example.com"],
            "configuration": {
                "auth_provider": "github",
                "client_id": "fake_client_id",
                "client_secret": "fake_client_secret",
                "redirect_uri": "http://localhost:7007/api/auth/callback",
            },
            "description": "GitHub provider. Configure it to enable GitHub authentication.",
        },
        {
            "auth_provider": "guest",
            "name": "Guest",
            "enabled": True,
            "filter_by_domain": ["example.com"],
            "configuration": {
                "auth_provider": "guest",
            },
            "description": "Guest provider enabled by default to configure the system. Disable it after configuring the system.",  # noqa: E501
        },
        {
            "auth_provider": "microsoft",
            "name": "Microsoft",
            "enabled": False,
            "filter_by_domain": ["example.com"],
            "configuration": {
                "auth_provider": "microsoft",
                "client_id": "fake_client_id",
                "client_secret": "fake_client_secret",
                "tenant_id": "fake_tenant_id",
                "redirect_uri": "http://localhost:7007/api/auth/callback",
            },
            "description": "Microsoft provider. Configure it to enable Microsoft authentication.",
        },
        {
            "auth_provider": "backstage",
            "name": "Backstage",
            "enabled": False,
            "filter_by_domain": ["example.com"],
            "configuration": {
                "auth_provider": "backstage",
                "backstage_private_key": "fake_private_key",
                "backstage_jwks_url": "http://localhost:7007/api/auth/.well-known/jwks.json",
            },
            "description": "Backstage provider. Configure it to enable Backstage authentication.",
        },
        {
            "auth_provider": "ik_service_account",
            "name": "IK Service Account",
            "enabled": True,
            "filter_by_domain": [],
            "configuration": {
                "auth_provider": "ik_service_account",
                "token_ttl": 3600,
            },
            "description": "Service account provider for machine-to-machine authentication.",
        },
    ]

    providers = await auth_provider_service.get_all()
    for provider in provider_fixtures:
        if provider["auth_provider"] not in [p.auth_provider for p in providers]:
            auth_provider = AuthProviderCreate(**provider)
            _ = await auth_provider_service.create(auth_provider, user)

    await session.commit()
