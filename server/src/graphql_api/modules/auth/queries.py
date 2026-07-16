import strawberry
from strawberry.types import Info

from core.personal_access_tokens.dependencies import get_personal_access_token_service
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.auth.types import PersonalAccessTokenType


@strawberry.type
class AuthQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def personal_access_tokens(self, info: Info) -> list[PersonalAccessTokenType]:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_personal_access_token_service(session=session)
        tokens = await service.list_tokens(requester.id)
        return tokens
