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

allowed_actions = ["read", "write", "admin"]


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

    async def get_all_policies(self, v0_value_to_filter: Any = None) -> set[tuple[Any]]:
        enforcer = await self.get_enforcer()
        stored_policies = (
            enforcer.get_filtered_named_policy("p", 0, v0_value_to_filter)
            if v0_value_to_filter
            else enforcer.get_policy()
        )
        policies_set = set([tuple(lst) for lst in stored_policies])
        return policies_set

    async def send_reload_event(self):
        event_message = MessageModel()
        event_message.message_type = "event"
        event_message.metadata["event"] = "reload_policies"
        event_message.exchange = "ik_event_messages"
        event_message.exchange_type = ExchangeType.FANOUT
        await self.rabbitmq.send_message(event_message)

    async def enforce_casbin_user(
        self,
        user_id: str | uuid.UUID,
        object: uuid.UUID | str,
        action: str = "read",
        object_type: str | None = None,
    ) -> bool:
        if action not in allowed_actions:
            return False

        enforcer = await self.get_enforcer()
        assert is_valid_uuid(user_id), "User ID must be a UUID"
        subject_id = f"user:{user_id}"

        if is_valid_uuid(object):
            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = f"resource:{object}"
        elif isinstance(object, str):
            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = object
        else:
            raise ValueError("Casbin object must be a string or UUID")

        result = enforcer.enforce(subject_id, object_id, action)
        if result is True:
            return True
        return False

    async def get_user_roles(self, user_id: str | uuid.UUID) -> list[str]:
        if is_valid_uuid(user_id) is False:
            raise ValueError("User ID must be a valid UUID")
        enforcer = await self.get_enforcer()
        return list(set([role[1] for role in enforcer.get_filtered_named_grouping_policy("g", 0, f"user:{user_id}")]))

    async def list_user_permissions_for_entity(self, user_id: str | uuid.UUID, resource_id: str) -> list[str]:
        if await self.enforce_casbin_user(user_id, resource_id, "admin") is True:
            return ["read", "write", "admin"]

        if await self.enforce_casbin_user(user_id, resource_id, "write") is True:
            return ["read", "write"]

        if await self.enforce_casbin_user(user_id, resource_id, "read") is True:
            return ["read"]

        return []
