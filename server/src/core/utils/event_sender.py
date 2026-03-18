import json
import logging
from contextvars import ContextVar

from aio_pika import ExchangeType
from pydantic import BaseModel
from uuid import UUID

from core.base_models import MessageModel
from core.rabbitmq import RabbitMQConnection
from core.users.model import UserDTO
from core.utils.json_encoder import JsonEncoder
from core.scheduler.model import JobType

logger = logging.getLogger(__name__)

# Request-scoped registry of EventSender instances that have pending messages
_pending_senders: ContextVar[list["EventSender"] | None] = ContextVar("_pending_senders", default=None)


async def flush_all_pending_senders():
    """Flush all EventSender instances that have buffered messages.
    Call this after session.commit() to guarantee consumers see committed data."""
    senders = _pending_senders.get()
    if not senders:
        return

    to_flush = senders.copy()
    senders.clear()
    for sender in to_flush:
        await sender.flush()


class EventSender:
    def __init__(self, entity_name: str):
        self.entity_name: str = entity_name
        self._buffer: list[MessageModel] = []

    def _register_pending(self):
        """Register this sender in the context-local pending list."""
        senders = _pending_senders.get()
        if senders is None:
            _pending_senders.set([self])
            return

        if self not in senders:
            senders.append(self)

    async def send_task(
        self,
        entity_id: UUID | str,
        requester: UserDTO,
        action: str = "execute",
        trace_id: str | None = None,
    ):
        logger.debug(f"Sending task for {self.entity_name} {entity_id} with action {action}")
        message = MessageModel()
        message.metadata["id"] = str(entity_id)
        message.metadata["action"] = action
        message.metadata["entity_controller"] = self.entity_name
        message.metadata["user"] = requester.id
        message.metadata["trace_id"] = trace_id
        message.routing_key = "ik_tasks"
        message.exchange_type = ExchangeType.DIRECT
        self._buffer.append(message)
        self._register_pending()

    async def send_event(self, entity_instance: BaseModel, event: str):
        event_message = MessageModel()
        event_message.message_type = "event"
        event_message.metadata["event"] = event
        event_message.exchange = "ik_event_messages"
        event_message.exchange_type = ExchangeType.FANOUT
        event_message.body = json.loads(json.dumps(entity_instance.model_dump(), cls=JsonEncoder))
        self._buffer.append(event_message)
        self._register_pending()

    async def send_scheduler_job(self, job_id: UUID, job_type: JobType, job_script: str):
        message = MessageModel()
        message.routing_key = "ik_tasks"
        message.message_type = "scheduler_job"
        message.exchange_type = ExchangeType.DIRECT

        message.body["job_id"] = job_id
        message.body["job_type"] = job_type
        message.body["job_script"] = job_script
        self._buffer.append(message)
        self._register_pending()

    async def send_message(self, message: MessageModel):
        self._buffer.append(message)
        self._register_pending()

    async def flush(self):
        """Publish all buffered messages to RabbitMQ.
        Call this AFTER session.commit() to guarantee consumers
        see committed data."""
        messages = self._buffer.copy()
        self._buffer.clear()
        for message in messages:
            confirm = message.routing_key == "ik_tasks" and message.message_type != "scheduler_job"
            await RabbitMQConnection.send_message(message, confirm=confirm)
