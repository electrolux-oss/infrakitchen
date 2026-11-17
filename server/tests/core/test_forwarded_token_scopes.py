from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest

from core.personal_access_tokens.scopes import get_current_token_scopes, set_current_token_scopes
from core.sso.functions import create_user_token, get_user_from_token
from core.users.model import UserDTO


def _user() -> UserDTO:
    return UserDTO(id=uuid4(), identifier="alice@example.com", provider="guest")


@pytest.fixture(autouse=True)
def reset_scopes():
    set_current_token_scopes(None)
    yield
    set_current_token_scopes(None)


async def _authenticate(token: str) -> None:
    service: Any = None  # the InfraKitchen JWT path never touches the service
    await get_user_from_token(service, token)


@pytest.mark.asyncio
async def test_scoped_token_sets_request_scopes():
    token = create_user_token(_user(), datetime.now(UTC) + timedelta(minutes=5), scopes=["read:resource"])
    await _authenticate(token)
    assert get_current_token_scopes() == {"read:resource"}


@pytest.mark.asyncio
async def test_regular_session_token_is_unscoped():
    token = create_user_token(_user(), datetime.now(UTC) + timedelta(minutes=5))
    await _authenticate(token)
    assert get_current_token_scopes() is None
