from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper
from strawberry.scalars import JSON
from strawberry.types import Info
import strawberry

from application.favorites.model import Favorite


favorite_mapper = StrawberrySQLAlchemyMapper()


@favorite_mapper.type(Favorite)
class FavoriteType:
    component_type: str = ""
    component_id: str = ""

    @strawberry.field
    async def component_data(self, info: Info) -> JSON | None:
        loader = info.context["loaders"].get(self.component_type)
        if loader is None:
            return None
        return await loader.load(str(self.component_id))


favorite_mapper.finalize()
