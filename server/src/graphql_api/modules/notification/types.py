import uuid
from strawberry.scalars import JSON
import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.notifications.model import Subscription, NotificationPreference
from graphql_api.modules.user.types import UserType


subscription_mapper = StrawberrySQLAlchemyMapper()
notification_preference_mapper = StrawberrySQLAlchemyMapper()


@subscription_mapper.type(Subscription)
class SubscriptionType:
    id: uuid.UUID = strawberry.UNSET
    entity_id: str | None = None
    entity_type: str | None = None
    user: UserType | None = None

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        if self.entity_id is None or self.entity_type is None:
            return None

        loader = info.context["loaders"].get(self.entity_type)
        if loader is None:
            return None
        return await loader.load(str(self.entity_id))


@notification_preference_mapper.type(NotificationPreference)
class NotificationPreferenceType:
    id: uuid.UUID = strawberry.UNSET
    user: UserType | None = None


subscription_mapper.finalize()
notification_preference_mapper.finalize()
