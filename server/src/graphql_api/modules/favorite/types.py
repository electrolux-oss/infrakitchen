from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper
from strawberry.scalars import JSON
from strawberry.types import Info
import strawberry

from application.favorites.model import Favorite
from graphql_api.dataloaders.entity_loaders import load_entity_data


favorite_mapper = StrawberrySQLAlchemyMapper()


@favorite_mapper.type(Favorite)
class FavoriteType:
    component_type: str = ""
    component_id: str = ""

    @strawberry.field
    async def component_data(self, info: Info) -> JSON | None:
        return await load_entity_data(info, self.component_type, str(self.component_id))


favorite_mapper.finalize()
