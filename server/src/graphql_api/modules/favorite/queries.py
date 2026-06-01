import strawberry
from sqlalchemy import select
from strawberry.types import Info

from application.favorites.model import Favorite
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.favorite.types import FavoriteType


@strawberry.type
class FavoriteQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def favorites(self, info: Info) -> list[FavoriteType]:
        session = info.context["session"]
        user = info.context["user"]
        stmt = select(Favorite).where(Favorite.user_id == user.id)
        result = await session.execute(stmt)
        return result.scalars().all()
