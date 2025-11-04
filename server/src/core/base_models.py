import uuid
from pydantic import Field
from pydantic import BaseModel as PydanticBaseModel
from datetime import datetime

from sqlalchemy import UUID, DateTime, ForeignKey, func
from sqlalchemy.ext.asyncio import AsyncAttrs

import json
from typing import Any, Literal, TypeVar

from aio_pika import ExchangeType
from .utils.json_encoder import JsonEncoder
from .constants import ModelState, ModelStatus
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Enum as SQLAlchemyEnum


class Base(AsyncAttrs, DeclarativeBase):
    __abstract__: bool = True
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class BaseRevision(Base):
    __abstract__: bool = True
    revision_number: Mapped[int] = mapped_column(default=1)


class BaseState(Base):
    __abstract__: bool = True
    state: Mapped[ModelState] = mapped_column(
        SQLAlchemyEnum(ModelState, name="model_state", native_enum=False), nullable=False, default=ModelState.PROVISION
    )
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.QUEUED,
    )


class BaseEntity(BaseRevision, BaseState):
    __abstract__: bool = True

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class BaseModel(PydanticBaseModel):
    id: uuid.UUID | None = Field(default=None)


class PatchBodyModel(PydanticBaseModel):
    action: str


TMessageModel = TypeVar("TMessageModel", bound="MessageModel")


class MessageModel(PydanticBaseModel):
    body: dict[str, Any] = Field(default_factory=dict)
    message_type: Literal["user", "notification", "log", "broadcast", "task", "event", "scheduler_job"] = Field(
        default="user"
    )
    exchange: str = Field(default="ik_tasks")
    exchange_type: ExchangeType = Field(default=ExchangeType.DIRECT)
    routing_key: str | None = Field(default="")
    metadata: dict[str, Any] = Field(default_factory=dict)

    def to_bytes(self) -> bytes:
        result = self.body
        result["_metadata"] = self.metadata
        result["_metadata"].update({"_message_type": self.message_type})
        result["_metadata"].update({"_routing_key": self.routing_key})
        return bytes(json.dumps(result, cls=JsonEncoder), "utf-8")

    @classmethod
    def load_from_bytes(cls: type[TMessageModel], data: bytes) -> TMessageModel:
        json_data = json.loads(data)
        metadata: dict[str, Any] = {}
        routing_key = ""

        if "_metadata" in json_data:
            metadata = json_data.pop("_metadata")

        message_type = "user"  # Default value for message_type
        if "_message_type" in metadata:
            message_type = metadata.pop("_message_type")

        if "_routing_key" in metadata:
            routing_key = metadata.pop("_routing_key")

        return cls(body=json_data, metadata=metadata, message_type=message_type, routing_key=routing_key)
