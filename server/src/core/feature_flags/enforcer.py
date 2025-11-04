from aio_pika import ExchangeType

from core.base_models import MessageModel
from core.casbin.enforcer import SingletonMeta
from ..rabbitmq import RabbitMQConnection


class FeatureFlagEnforcer(metaclass=SingletonMeta):
    def __init__(self, rabbitmq: RabbitMQConnection | None = None):
        self.rabbitmq: RabbitMQConnection = rabbitmq or RabbitMQConnection()

    async def send_reload_configs_event(self):
        event_message = MessageModel()
        event_message.message_type = "event"
        event_message.metadata["event"] = "reload_feature_flags_configs"
        event_message.exchange = "ik_event_messages"
        event_message.exchange_type = ExchangeType.FANOUT

        await self.rabbitmq.send_message(event_message)
