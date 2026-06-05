import strawberry
from strawberry.types import Info

from core.auth_providers.dependencies import get_auth_provider_service


@strawberry.type
class ConfigQuery:
    @strawberry.field
    async def enabled_auth_providers(self, info: Info) -> list[str]:
        session = info.context["session"]
        service = get_auth_provider_service(session=session)
        enabled_providers = await service.query_all(
            filter={"enabled": True}, fields={"auth_provider": None, "enabled": None}
        )
        return [provider.auth_provider for provider in enabled_providers]
