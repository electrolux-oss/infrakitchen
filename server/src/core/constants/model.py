from typing import TypeVar, Any
from enum import StrEnum, unique

from pydantic import BaseModel, Field

T = TypeVar("T", bound="ConstantModel")


class ConstantModel(BaseModel):
    """
    Container for a single entity Constant record.
    """

    name: str = Field(..., frozen=True)
    description: str | None = Field(default="")
    values: dict[str, Any] = Field(default={})


@unique
class ModelActions(StrEnum):
    CREATE = "create"  # create a new resource
    UPDATE = "update"  # update an existing resource
    EDIT = "edit"  # edit an existing resource
    DESTROY = "destroy"  # destroy an existing resource
    DELETE = "delete"  # delete an existing resource
    REJECT = "reject"  # reject modification of an existing resource
    APPROVE = "approve"
    EXECUTE = "execute"
    RETRY = "retry"
    RECREATE = "recreate"
    SYNC = "sync"
    DRYRUN = "dryrun"
    DRYRUN_WITH_TEMP_STATE = "dryrun_with_temp_state"
    DISABLE = "disable"
    ENABLE = "enable"
    DOWNLOAD = "download"
    RESET = "reset"


@unique
class ModelStatus(StrEnum):
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    ERROR = "error"
    UNKNOWN = "unknown"
    APPROVAL_PENDING = "approval_pending"
    PENDING = "pending"
    REJECTED = "rejected"
    READY = "ready"
    ENABLED = "enabled"
    DISABLED = "disabled"


@unique
class ModelState(StrEnum):
    PROVISION = "provision"
    PROVISIONED = "provisioned"
    DESTROY = "destroy"
    DESTROYED = "destroyed"
