import json
import logging
from contextvars import ContextVar
from typing import Any

from aio_pika import ExchangeType
from pydantic import BaseModel
from uuid import UUID

from core.base_models import MessageModel
from core.config import Settings
from core.rabbitmq import RabbitMQConnection
from core.users.model import UserDTO
from core.utils.json_encoder import JsonEncoder
from core.scheduler.model import JobType
from core.task_queue import enqueue as task_queue_enqueue
from core.task_queue.model import TaskQueueKind

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
        self._task_buffer: list[dict[str, Any]] = []

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
        audit_log_id: str | UUID | None = None,
        extra_metadata: dict[str, str] | None = None,
        delay_seconds: float | None = None,
    ):
        """Buffer a task for the worker queue. It is written to the DB queue on flush.

        Workers don't pick the task up for ``delay_seconds`` (by default
        ``TASK_QUEUE_CANCEL_DELAY_SECONDS``), so the user can still cancel it. Pass 0 for
        tasks nobody is waiting to cancel, such as follow-ups sent by a worker.
        """
        logger.debug(f"Sending task for {self.entity_name} {entity_id} with action {action}")
        payload: dict[str, Any] = {
            "user": str(requester.id),
            "trace_id": trace_id,
            "audit_log_id": str(audit_log_id) if audit_log_id else None,
        }
        entity = self.entity_name
        if extra_metadata:
            extra = dict(extra_metadata)
            entity = extra.pop("entity_controller", None) or entity
            payload.update(extra)

        self._task_buffer.append(
            {
                "kind": TaskQueueKind.ENTITY_TASK,
                "entity": entity,
                "entity_id": UUID(str(entity_id)),
                "action": str(action),
                "payload": payload,
                "created_by": requester.id,
                "delay_seconds": Settings().TASK_QUEUE_CANCEL_DELAY_SECONDS if delay_seconds is None else delay_seconds,
            }
        )
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

    async def send_reload_event(self, event: str):
        """Broadcast a bodyless reload signal on the FANOUT event exchange.

        Used to tell other processes to reload some state (e.g. the scheduler
        re-reading its jobs from the DB). Buffered and flushed after commit.
        """
        event_message = MessageModel()
        event_message.message_type = "event"
        event_message.metadata["event"] = event
        event_message.exchange = "ik_event_messages"
        event_message.exchange_type = ExchangeType.FANOUT
        self._buffer.append(event_message)
        self._register_pending()

    async def send_scheduler_job(self, job_id: UUID, job_type: JobType, job_script: str):
        self._task_buffer.append(
            {
                "kind": TaskQueueKind.SCHEDULER_JOB,
                "entity": "scheduler_job",
                "payload": {"job_id": str(job_id), "job_type": str(job_type), "job_script": job_script},
            }
        )
        self._register_pending()

    async def send_message(self, message: MessageModel):
        self._buffer.append(message)
        self._register_pending()

    async def flush(self):
        """Write buffered tasks to the DB queue and publish buffered messages to RabbitMQ.
        Call this AFTER session.commit() to guarantee consumers
        see committed data."""
        tasks = self._task_buffer.copy()
        self._task_buffer.clear()
        messages = self._buffer.copy()
        self._buffer.clear()

        if tasks:
            await task_queue_enqueue.enqueue_tasks(tasks)

        for message in messages:
            await RabbitMQConnection.send_message(message)
