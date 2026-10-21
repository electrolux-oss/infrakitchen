import uuid
from strawberry.scalars import JSON
import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.notifications.model import Subscription, NotificationPreference, UserNotification
from graphql_api.modules.user.types import UserType
from graphql_api.dataloaders.entity_loaders import has_entity_loader, load_entity_data


subscription_mapper = StrawberrySQLAlchemyMapper()
notification_preference_mapper = StrawberrySQLAlchemyMapper()
user_notification_mapper = StrawberrySQLAlchemyMapper()


@subscription_mapper.type(Subscription)
class SubscriptionType:
    id: uuid.UUID = strawberry.UNSET
    entity_id: str | None = None
    entity_type: str | None = None
    user: UserType | None = None

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        return await load_entity_data(info, self.entity_type, self.entity_id)


@notification_preference_mapper.type(NotificationPreference)
class NotificationPreferenceType:
    id: uuid.UUID = strawberry.UNSET
    user: UserType | None = None


@user_notification_mapper.type(UserNotification)
class UserNotificationType:
    __exclude__ = ["user_id"]

    id: uuid.UUID = strawberry.UNSET
    entity_id: str | None = None
    entity_type: str | None = None

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        return await load_entity_data(info, self.entity_type, self.entity_id)

    @strawberry.field
    def entity_loader_missing(self, info: Info) -> bool:
        return not has_entity_loader(info, self.entity_type)


subscription_mapper.finalize()
notification_preference_mapper.finalize()
user_notification_mapper.finalize()
