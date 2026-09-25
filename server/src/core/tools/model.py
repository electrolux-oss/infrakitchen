from datetime import datetime, UTC
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import UUID, BigInteger, Boolean, DateTime, ForeignKey, Index, LargeBinary, UniqueConstraint, func, text
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base_models import Base
from core.constants.model import ModelStatus
from core.users.model import User


class Tool(Base):
    """
    Executable artifact (e.g. OpenTofu or Terraform release) stored in the database,
    so every worker can run the same version without having it installed in the runtime image.
    """

    __tablename__: str = "tools"
    __table_args__ = (
        UniqueConstraint("name", "version", "os", "arch", name="uq_tools_name_version_os_arch"),
        # at most one tool is the global default
        Index("uq_tools_is_default", "is_default", unique=True, postgresql_where=text("is_default")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(index=True)
    version: Mapped[str] = mapped_column()
    os: Mapped[str] = mapped_column()
    arch: Mapped[str] = mapped_column()
    executable: Mapped[str] = mapped_column()
    source_url: Mapped[str] = mapped_column(default="")
    sha256: Mapped[str] = mapped_column(default="")
    size: Mapped[int] = mapped_column(BigInteger, default=0)
    # release archive, loaded only when a worker unpacks it
    content: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.QUEUED,
    )
    error_message: Mapped[str] = mapped_column(default="")
    # used by resources and executors that don't select a tool
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    creator: Mapped[User | None] = relationship("User", lazy="joined")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())


class ToolDTO(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    version: str = Field(...)
    os: str = Field(...)
    arch: str = Field(...)
    executable: str = Field(...)
    source_url: str = Field(default="")
    sha256: str = Field(default="")
    size: int = Field(default=0)
    status: ModelStatus = Field(default=ModelStatus.QUEUED)
    error_message: str = Field(default="")
    is_default: bool = Field(default=False)
    created_by: uuid.UUID | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = ConfigDict(from_attributes=True)
