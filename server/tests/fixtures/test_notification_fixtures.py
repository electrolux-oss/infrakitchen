from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from core.notifications.crud import NotificationPreferenceCRUD, SubscriptionCRUD
from core.notifications.model import NotificationPreference, Subscription
from core.notifications.service import NotificationPreferenceService, SubscriptionService


@pytest.fixture
def mock_subscription_crud():
    crud = Mock(spec=SubscriptionCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.delete = AsyncMock()
    crud.delete_many_by_entity_id = AsyncMock()
    return crud


@pytest.fixture
def mock_subscription_service(mock_subscription_crud):
    return SubscriptionService(crud=mock_subscription_crud)


@pytest.fixture
def mock_notification_preference_crud():
    crud = Mock(spec=NotificationPreferenceCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.delete = AsyncMock()
    return crud


@pytest.fixture
def mock_notification_preference_service(mock_notification_preference_crud):
    return NotificationPreferenceService(crud=mock_notification_preference_crud)


@pytest.fixture
def mocked_subscription(mocked_user):
    mocked_user.meta = {"slack_id": "U123"}
    mocked_user.deactivated = False

    return Subscription(
        id=uuid4(),
        user_id=mocked_user.id,
        user=mocked_user,
        entity_type="resource",
        entity_id=uuid4(),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def mocked_notification_preference(mocked_user):
    mocked_user.meta = {"slack_id": "U123"}
    mocked_user.deactivated = False

    return NotificationPreference(
        id=uuid4(),
        user_id=mocked_user.id,
        user=mocked_user,
        event_type="update",
        channels=["IN_APP", "SLACK"],
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
