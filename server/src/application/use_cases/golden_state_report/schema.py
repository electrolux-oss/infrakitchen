import uuid

from pydantic import BaseModel, Field


class GoldenStateProjectReport(BaseModel):
    project_id: uuid.UUID | None = Field(default=None)
    project_name: str
    score: float
    total: int
    compliant: int
    update_available: int
    deprecated: int
    critical: int
    no_golden: int


class GoldenStateSummary(BaseModel):
    overall_score: float
    projects: list[GoldenStateProjectReport] = Field(default_factory=list)
