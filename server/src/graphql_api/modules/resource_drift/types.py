import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.resource_drifts.model import ResourceDrift

resource_drift_mapper = StrawberrySQLAlchemyMapper()


@resource_drift_mapper.type(ResourceDrift)
class ResourceDriftType:
    # known_drift is internal: notification keys, never sent to the UI
    __exclude__ = ["resource_id", "known_drift"]

    id: uuid.UUID = strawberry.UNSET  # type: ignore[assignment]


resource_drift_mapper.finalize()
