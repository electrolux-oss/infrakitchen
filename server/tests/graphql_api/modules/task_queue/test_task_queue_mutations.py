from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from graphql_api.modules.task_queue.mutations import _can_cancel

MODULE = "graphql_api.modules.task_queue.mutations"


def make_user(primary_id=None, secondary_id=None) -> Any:
    """Duck-typed stand-in for UserDTO with only the fields _can_cancel reads."""
    return SimpleNamespace(
        id=uuid4(),
        primary_account=[SimpleNamespace(id=primary_id)] if primary_id else [],
        secondary_accounts=[SimpleNamespace(id=secondary_id)] if secondary_id else [],
    )


class TestCanCancel:
    @pytest.fixture(autouse=True)
    def permissions(self):
        with (
            patch(f"{MODULE}.user_entity_permissions", new=AsyncMock(return_value=["read", "write"])) as entity_perms,
            patch(f"{MODULE}.user_is_super_admin", new=AsyncMock(return_value=False)) as super_admin,
        ):
            yield SimpleNamespace(entity=entity_perms, super_admin=super_admin)

    async def test_requester_can_cancel_own_task(self):
        user = make_user()
        assert await _can_cancel(user, user.id, "resource", uuid4()) is True

    async def test_linked_account_counts_as_requester(self):
        primary_id = uuid4()
        user = make_user(primary_id=primary_id)
        assert await _can_cancel(user, primary_id, "resource", uuid4()) is True

    async def test_other_user_without_admin_cannot_cancel(self):
        assert await _can_cancel(make_user(), uuid4(), "resource", uuid4()) is False

    async def test_entity_admin_can_cancel(self, permissions):
        permissions.entity.return_value = ["read", "write", "admin"]
        assert await _can_cancel(make_user(), uuid4(), "resource", uuid4()) is True

    async def test_super_admin_can_cancel(self, permissions):
        permissions.super_admin.return_value = True
        assert await _can_cancel(make_user(), uuid4(), "resource", uuid4()) is True
