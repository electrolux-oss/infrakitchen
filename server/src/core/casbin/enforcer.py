import logging
import os
import uuid
from typing import Any

import casbin
import casbin_async_sqlalchemy_adapter

from core.permissions.model import Permission
from core.singleton_meta import SingletonMeta
from core.utils.model_tools import is_valid_uuid
from ..base_models import ExchangeType, MessageModel
from ..config import Settings
from ..rabbitmq import RabbitMQConnection

logger = logging.getLogger(__name__)


class CasbinEnforcer(metaclass=SingletonMeta):
    enforcer: casbin.AsyncEnforcer | None
    db_adapter: Any

    def __init__(self, adapter: Any = None, rabbitmq: RabbitMQConnection | None = None):
        sql_adapter = casbin_async_sqlalchemy_adapter.Adapter(Settings().db_url, db_class=Permission)
        self.enforcer = None
        self.db_adapter = adapter or sql_adapter
        self.rabbitmq: RabbitMQConnection = rabbitmq or RabbitMQConnection()

    async def init_enforcer(self):
        model_path = os.path.join(os.path.dirname(__file__), "model.conf")

        self.enforcer = casbin.AsyncEnforcer(model_path, self.db_adapter, enable_log=os.getenv("LOG_LEVEL") == "DEBUG")
        await self.enforcer.load_policy()
        logger.debug(self.enforcer.get_policy())

    async def get_enforcer(self) -> casbin.AsyncEnforcer:
        if not self.enforcer:
            await self.init_enforcer()
        if not self.enforcer:
            raise ValueError("Enforcer is not initialized")
        return self.enforcer

    async def send_reload_event(self):
        event_message = MessageModel()
        event_message.message_type = "event"
        event_message.metadata["event"] = "reload_policies"
        event_message.exchange = "ik_event_messages"
        event_message.exchange_type = ExchangeType.FANOUT
        await self.rabbitmq.send_message(event_message)

    async def get_user_roles(self, user_id: str | uuid.UUID) -> list[str]:
        if is_valid_uuid(user_id) is False:
            raise ValueError("User ID must be a valid UUID")
        enforcer = await self.get_enforcer()
        return list(set([role[1] for role in enforcer.get_filtered_named_grouping_policy("g", 0, f"user:{user_id}")]))
