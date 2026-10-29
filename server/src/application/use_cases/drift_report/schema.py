import uuid

from pydantic import BaseModel, Field


class DriftProjectReport(BaseModel):
    project_id: uuid.UUID | None = Field(default=None)
    project_name: str
    score: float
    total: int
    in_sync: int
    drifted: int
    error: int
    unknown: int


class DriftSummary(BaseModel):
    overall_score: float
    projects: list[DriftProjectReport] = Field(default_factory=list)
