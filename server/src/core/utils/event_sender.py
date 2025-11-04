import json
import logging

from aio_pika import ExchangeType
from pydantic import BaseModel
from uuid import UUID

from core.base_models import MessageModel
from core.rabbitmq import RabbitMQConnection
from core.users.model import UserDTO
from core.utils.json_encoder import JsonEncoder
from core.scheduler.model import JobType

logger = logging.getLogger(__name__)


class EventSender:
    def __init__(self, entity_name: str):
        self.entity_name: str = entity_name

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
        await RabbitMQConnection.send_message(message, confirm=True)

    async def send_event(self, entity_instance: BaseModel, event: str):
        event_message = MessageModel()
        event_message.message_type = "event"
        event_message.metadata["event"] = event
        event_message.exchange = "ik_event_messages"
        event_message.exchange_type = ExchangeType.FANOUT
        event_message.body = json.loads(json.dumps(entity_instance.model_dump(), cls=JsonEncoder))
        await RabbitMQConnection.send_message(event_message)

    async def send_scheduler_job(self, job_id: UUID, job_type: JobType, job_script: str):
        message = MessageModel()
        message.routing_key = "ik_tasks"
        message.message_type = "scheduler_job"
        message.exchange_type = ExchangeType.DIRECT

        message.body["job_id"] = job_id
        message.body["job_type"] = job_type
        message.body["job_script"] = job_script
        await RabbitMQConnection.send_message(message)
