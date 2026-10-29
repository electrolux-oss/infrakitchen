from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from core.constants.model import DriftStatus


class ResourceDriftResponse(BaseModel):
    status: DriftStatus
    checked_at: datetime
    summary: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)
