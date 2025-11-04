from datetime import datetime
import uuid
from sqlalchemy.orm import Mapped, mapped_column
from enum import Enum
from sqlalchemy import Enum as SQLAlchemyEnum

from sqlalchemy import UUID, func

from ..base_models import Base


class JobType(str, Enum):
    SQL = "SQL"
    BASH = "BASH"


class SchedulerJob(Base):
    __tablename__: str = "scheduler_jobs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[JobType] = mapped_column(SQLAlchemyEnum(JobType, name="type", native_enum=False), nullable=False)
    script: Mapped[str] = mapped_column()
    cron: Mapped[str] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=func.now())
