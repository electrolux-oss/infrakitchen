import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.resource_temp_state.model import ResourceTempState


resource_temp_state_mapper = StrawberrySQLAlchemyMapper()


@resource_temp_state_mapper.type(ResourceTempState)
class ResourceTempStateType:
    __exclude__ = ["created_by"]

    id: uuid.UUID = strawberry.UNSET  # type: ignore[assignment]


resource_temp_state_mapper.finalize()
