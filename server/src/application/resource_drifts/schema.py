import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field

from core.constants.model import DriftStatus


class ResourceDriftResponse(BaseModel):
    """
    The drift of a resource in a live event. The summary (the change list) is left out: it can be large,
    and an event larger than NOTIFY allows is cut down anyway; the Drift tab fetches it when the result changes.
    """

    status: DriftStatus
    checked_at: datetime
    first_detected_at: datetime | None = None
    consecutive_failures: int = 0
    last_error: str | None = None
    last_error_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ResourceDriftUpdate(BaseModel):
    """Event body of a changed drift result; the UI merges it into the resource with the same id."""

    id: uuid.UUID
    # None clears the drift label of a resource whose drift result was removed
    drift: ResourceDriftResponse | None

    @computed_field
    def _entity_name(self) -> str:
        return "resource"
