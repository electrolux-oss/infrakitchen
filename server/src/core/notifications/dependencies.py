from sqlalchemy.ext.asyncio import AsyncSession

from .crud import SubscriptionCRUD, NotificationPreferenceCRUD, UserNotificationCRUD
from .service import SubscriptionService, NotificationPreferenceService, UserNotificationService


def get_subscription_service(session: AsyncSession) -> SubscriptionService:
    return SubscriptionService(crud=SubscriptionCRUD(session=session))


def get_notification_preference_service(session: AsyncSession) -> NotificationPreferenceService:
    return NotificationPreferenceService(crud=NotificationPreferenceCRUD(session=session))


def get_user_notification_service(session: AsyncSession) -> UserNotificationService:
    return UserNotificationService(crud=UserNotificationCRUD(session=session))
