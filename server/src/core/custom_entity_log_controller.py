from contextlib import asynccontextmanager
import datetime
import logging
from typing import Any, Literal, Protocol
from uuid import UUID

from aio_pika import ExchangeType

from core.logs.model import Log
from core.database import SessionLocal

from .base_models import MessageModel
from .rabbitmq import RabbitMQConnection

logger = logging.getLogger("entity_logger")


@asynccontextmanager
async def get_session():
    async with SessionLocal() as session:
        yield session


class LoggerProtocol(Protocol):
    def info(self, data: str) -> None: ...
    def warning(self, data: str) -> None: ...
    def error(self, data: str) -> None: ...
    def debug(self, data: str) -> None: ...


class EntityLogger:
    def __init__(
        self,
        entity_name: str,
        entity_id: str | UUID,
        revision_number: int = 1,
        should_be_expired: bool = False,
        trace_id: str | None = None,
    ):
        self.bulk_logs_operations: list[Log] = []
        self.messages: list[MessageModel] = []
        self.entity_name: str | None = entity_name
        self.entity_id: str | UUID = entity_id
        self.revision_number: int = revision_number
        self.execution_start: int = int(datetime.datetime.now().timestamp())
        self.trace_id: str | None = trace_id
        # setup ttl for logs to be expired ex. dry run logs
        self.expire_at: datetime.datetime | None = None
        if should_be_expired:
            self.expire_at = datetime.datetime.now() + datetime.timedelta(days=5)

    def make_expired(self):
        self.expire_at = datetime.datetime.now() + datetime.timedelta(days=5)

    def add_log_header(self, data: str):
        log = Log(
            entity=self.entity_name,
            entity_id=self.entity_id,
            revision=self.revision_number,
            data=data,
            level="header",
            created_at=datetime.datetime.now(datetime.UTC),
            execution_start=self.execution_start,
            expire_at=self.expire_at,
            trace_id=self.trace_id,
        )

        self.bulk_logs_operations.append(log)

    def create_message(self, body: dict[str, Any]) -> MessageModel:
        message = MessageModel(
            body=body,
            message_type="log",
            exchange="ik_raw_messages",
            routing_key=f"logs.{self.entity_name}.{self.entity_id}",
            exchange_type=ExchangeType.TOPIC,
        )
        return message

    def append_log(self, data: str, level: Literal["info", "warn", "error", "debug"] = "info"):
        if data == "":
            return
        log = Log(
            entity=self.entity_name,
            entity_id=self.entity_id,
            revision=self.revision_number,
            data=data,
            level=level,
            created_at=datetime.datetime.now(datetime.UTC),
            execution_start=self.execution_start,
            expire_at=self.expire_at,
            trace_id=self.trace_id,
        )
        self.bulk_logs_operations.append(log)
        message = self.create_message(
            {
                "entity": self.entity_name,
                "entity_id": str(self.entity_id),
                "data": data,
                "level": level,
                "revision": self.revision_number,
                "created_at": datetime.datetime.now(datetime.UTC).isoformat(),
            }
        )
        self.messages.append(message)

    async def save_if_more_than(self, count: int):
        if len(self.bulk_logs_operations) > count:
            await self.save_log()

    async def save_log(self):
        if self.bulk_logs_operations:
            async with get_session() as session:
                session.add_all(self.bulk_logs_operations)
                self.bulk_logs_operations = []
                await session.commit()

        await self.send_messages()

    async def send_messages(self):
        for message in self.messages:
            await RabbitMQConnection.send_message(message)
        self.messages = []

    def add_divider(self):
        self.append_log("\n" + "=" * 100 + "\n")

    def add_dry_run(self):
        self.append_log(
            """
        ██████╗ ██████╗ ██╗   ██╗    ██████╗ ██╗   ██╗███╗   ██╗
        ██╔══██╗██╔══██╗╚██╗ ██╔╝    ██╔══██╗██║   ██║████╗  ██║
        ██║  ██║██████╔╝ ╚████╔╝     ██████╔╝██║   ██║██╔██╗ ██║
        ██║  ██║██╔══██╗  ╚██╔╝      ██╔══██╗██║   ██║██║╚██╗██║
        ██████╔╝██║  ██║   ██║       ██║  ██║╚██████╔╝██║ ╚████║
        ╚═════╝ ╚═╝  ╚═╝   ╚═╝       ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
        """
        )

    def info(self, data: str):
        logger.info(data)
        self.append_log(data, "info")

    def warning(self, data: str):
        logger.warning(data)
        self.append_log(data, "warn")

    def error(self, data: str):
        logger.error(data)
        self.append_log(data, "error")

    def debug(self, data: str):
        logger.debug(data)


CustomEntityLoggerType = LoggerProtocol
