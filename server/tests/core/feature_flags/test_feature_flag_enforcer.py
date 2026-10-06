from unittest.mock import AsyncMock

import core.pubsub as pubsub_mod
from core.feature_flags.enforcer import FeatureFlagEnforcer


class TestFeatureFlagEnforcer:
    def setup_method(self):
        FeatureFlagEnforcer._instances.clear()

    def test_singleton_behavior(self):
        enforcer1 = FeatureFlagEnforcer()
        enforcer2 = FeatureFlagEnforcer()

        assert enforcer1 is enforcer2
        assert id(enforcer1) == id(enforcer2)

    async def test_send_reload_configs_event_success(self, monkeypatch):
        publish = AsyncMock()
        monkeypatch.setattr(pubsub_mod, "publish", publish)

        await FeatureFlagEnforcer().send_reload_configs_event()

        publish.assert_awaited_once()
        topic, data = publish.await_args_list[0].args
        assert topic == pubsub_mod.EVENTS_TOPIC
        assert data["_metadata"]["event"] == "reload_feature_flags_configs"
        assert data["_metadata"]["_message_type"] == "event"
