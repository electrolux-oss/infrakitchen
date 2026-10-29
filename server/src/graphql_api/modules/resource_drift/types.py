import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.resource_drifts.model import ResourceDrift

resource_drift_mapper = StrawberrySQLAlchemyMapper()


@resource_drift_mapper.type(ResourceDrift)
class ResourceDriftType:
    __exclude__ = ["resource_id"]

    id: uuid.UUID = strawberry.UNSET  # type: ignore[assignment]


resource_drift_mapper.finalize()
