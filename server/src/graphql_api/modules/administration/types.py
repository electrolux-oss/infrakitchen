import uuid

import strawberry


@strawberry.type
class FeatureFlagType:
    name: str
    config_name: str
    enabled: bool | None
    updated_by: uuid.UUID | None = None


@strawberry.type
class SimpleStatusType:
    status: str
