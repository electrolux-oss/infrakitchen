from datetime import datetime, UTC
from pydantic import BaseModel, Field


class CacheCreate(BaseModel):
    module: str = Field(..., title="Module name")
    key: str = Field(..., title="Cache key")
    value: bytes
    expire_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
