import core.pubsub as pubsub
from core.base_models import MessageModel
from core.casbin.enforcer import SingletonMeta


class FeatureFlagEnforcer(metaclass=SingletonMeta):
    async def send_reload_configs_event(self):
        event_message = MessageModel(message_type="event", topic=pubsub.EVENTS_TOPIC)
        event_message.metadata["event"] = "reload_feature_flags_configs"

        await pubsub.publish(event_message.topic, event_message.to_data())
