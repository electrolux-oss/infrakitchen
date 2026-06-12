import uuid
from typing import cast

import strawberry
from strawberry.types import Info

from application.favorites.dependencies import get_favorite_service
from application.favorites.model import FavoriteComponentType
from application.favorites.schema import FavoriteCreate
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.favorite.types import FavoriteType


@strawberry.input
class FavoriteCreateInput:
    component_type: str
    component_id: uuid.UUID


@strawberry.input
class FavoriteDeleteInput:
    component_type: str
    component_id: uuid.UUID


@strawberry.type
class FavoriteMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_favorite(self, info: Info, input: FavoriteCreateInput) -> FavoriteType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_favorite_service(session)

        return await service.create_entity(
            favorite=FavoriteCreate(
                component_type=cast(FavoriteComponentType, input.component_type),
                component_id=input.component_id,
            ),
            user_id=requester.id,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_favorite(self, info: Info, input: FavoriteDeleteInput) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_favorite_service(session)

        await service.delete(
            user_id=requester.id,
            component_type=cast(FavoriteComponentType, input.component_type),
            component_id=input.component_id,
        )
        return True
