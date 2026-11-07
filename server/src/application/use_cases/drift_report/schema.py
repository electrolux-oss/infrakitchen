import uuid

from pydantic import BaseModel


class DriftCounts(BaseModel):
    """
    Resources by the result of their last successful drift check; `total` is their sum.
    `failing` counts the resources whose last check failed, whatever their result.
    """

    total: int = 0
    in_sync: int = 0
    drifted: int = 0
    # no check succeeded yet, the last one failed
    error: int = 0
    # never checked, or outdated by a failed apply
    unchecked: int = 0
    failing: int = 0


class DriftProjectReport(DriftCounts):
    project_id: uuid.UUID | None = None
    project_name: str


class DriftReport(DriftCounts):
    projects: list[DriftProjectReport] = []
