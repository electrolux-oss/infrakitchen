from datetime import datetime
import uuid

from sqlalchemy import JSON, UUID, Column, DateTime, ForeignKey, Index, Table, func
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from application.integrations.model import Integration
from application.storages.model import Storage
from core.base_models import Base
from core.constants.model import ModelStatus
from core.tools.model import Tool
from core.users.model import User

# {module} is the module path, {module_name} its folder name, {env} the environment name and {region} the
# region (added before the file name when a run has a region and the template does not use it).
DEFAULT_STATE_PATH_TEMPLATE = "{module}/{env}.tfstate"


iac_environment_config_integrations = Table(
    "iac_environment_config_integrations",
    Base.metadata,
    Column("environment_config_id", ForeignKey("iac_environment_configs.id", ondelete="CASCADE"), primary_key=True),
    Column("integration_id", ForeignKey("integrations.id", ondelete="CASCADE"), primary_key=True),
)


class IacEnvironmentConfig(Base):
    """How the modules of an IaC repository are run in one environment, matched by environment name."""

    __tablename__: str = "iac_environment_configs"

    source_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_codes.id", name="fk_iac_environment_config_source_code_id", ondelete="CASCADE"),
    )
    name: Mapped[str] = mapped_column()
    # Cloud credentials for the runs.
    integrations: Mapped[list[Integration]] = relationship(
        secondary=iac_environment_config_integrations, lazy="selectin"
    )
    # State backend written by InfraKitchen; None uses the module's own backend block.
    storage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storages.id", name="fk_iac_environment_config_storage_id"), nullable=True
    )
    storage: Mapped[Storage | None] = relationship("Storage", lazy="joined")
    state_path_template: Mapped[str] = mapped_column(default=DEFAULT_STATE_PATH_TEMPLATE)
    # Regions to run in when the repository does not show them (region folders or var files),
    # e.g. when the region is only a variable. Discovered regions take precedence.
    regions: Mapped[list[str] | None] = mapped_column(JSON(none_as_null=True), nullable=True, default=list)
    # Variable that gets the region of a run (as TF_VAR_<name>); AWS_REGION is always set.
    region_variable: Mapped[str | None] = mapped_column(nullable=True)
    # Passed to every module run in the environment as TF_VAR_<name>.
    variables: Mapped[dict[str, str] | None] = mapped_column(JSON(none_as_null=True), nullable=True, default=dict)
    # Region -> the variables that differ there; they override the environment's.
    region_variables: Mapped[dict[str, dict[str, str]] | None] = mapped_column(
        JSON(none_as_null=True), nullable=True, default=dict
    )
    # Tofu version; None uses the default one.
    tool_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id", ondelete="RESTRICT", name="fk_iac_environment_config_tool_id"),
        nullable=True,
    )
    tool: Mapped[Tool | None] = relationship("Tool", lazy="joined")

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    __table_args__ = (Index("ix_iac_environment_config_source_code_id_name", "source_code_id", "name", unique=True),)


class IacRun(Base):
    """One plan (later also apply) of a module in an environment, at one commit."""

    __tablename__: str = "iac_runs"

    source_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_codes.id", name="fk_iac_run_source_code_id", ondelete="CASCADE"),
    )
    module_path: Mapped[str] = mapped_column()
    environment_name: Mapped[str] = mapped_column()
    # None for an environment that is run without regions.
    region: Mapped[str | None] = mapped_column(nullable=True)
    action: Mapped[str] = mapped_column()
    # Branch or tag the run was started from, None when a commit was picked directly.
    ref: Mapped[str | None] = mapped_column(nullable=True)
    # Commit that is run; resolved from the ref by the worker when not picked directly.
    sha: Mapped[str | None] = mapped_column(nullable=True)
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False), default=ModelStatus.QUEUED
    )
    # Plan summary, None until the plan has run.
    to_add: Mapped[int | None] = mapped_column(nullable=True)
    to_change: Mapped[int | None] = mapped_column(nullable=True)
    to_destroy: Mapped[int | None] = mapped_column(nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    creator: Mapped[User] = relationship("User", lazy="joined")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_iac_run_stack", "source_code_id", "module_path", "environment_name", "created_at"),)
