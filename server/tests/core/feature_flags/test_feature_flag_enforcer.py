from unittest.mock import AsyncMock, MagicMock
import pytest
from aio_pika import ExchangeType

from core.feature_flags.enforcer import FeatureFlagEnforcer
from core.base_models import MessageModel


class TestFeatureFlagEnforcer:
    mock_rabbitmq: MagicMock = MagicMock()
    enforcer: FeatureFlagEnforcer = FeatureFlagEnforcer()

    def setup_method(self):
        self.mock_rabbitmq = MagicMock()
        self.mock_rabbitmq.send_message = AsyncMock()

        FeatureFlagEnforcer._instances.clear()
        self.enforcer = FeatureFlagEnforcer(rabbitmq=self.mock_rabbitmq)

    def test_singleton_behavior(self):
        FeatureFlagEnforcer._instances.clear()

        enforcer1 = FeatureFlagEnforcer(rabbitmq=self.mock_rabbitmq)
        enforcer2 = FeatureFlagEnforcer(rabbitmq=self.mock_rabbitmq)

        assert enforcer1 is enforcer2
        assert id(enforcer1) == id(enforcer2)

    @pytest.mark.asyncio
    async def test_send_reload_configs_event_success(self):
        await self.enforcer.send_reload_configs_event()

        self.mock_rabbitmq.send_message.assert_awaited_once()

        call_args = self.mock_rabbitmq.send_message.call_args
        sent_message = call_args[0][0]

        assert isinstance(sent_message, MessageModel)
        assert sent_message.message_type == "event"
        assert sent_message.metadata["event"] == "reload_feature_flags_configs"
        assert sent_message.exchange == "ik_event_messages"
        assert sent_message.exchange_type == ExchangeType.FANOUT
