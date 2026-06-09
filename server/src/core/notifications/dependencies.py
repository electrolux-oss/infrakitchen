from sqlalchemy.ext.asyncio import AsyncSession

from .crud import SubscriptionCRUD, NotificationPreferenceCRUD
from .service import SubscriptionService, NotificationPreferenceService


def get_subscription_service(session: AsyncSession) -> SubscriptionService:
    return SubscriptionService(crud=SubscriptionCRUD(session=session))


def get_notification_preference_service(session: AsyncSession) -> NotificationPreferenceService:
    return NotificationPreferenceService(crud=NotificationPreferenceCRUD(session=session))
