# pyright: reportArgumentType=false
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

import core.users.functions as user_functions
from core.notifications.crud import UserNotificationCRUD, _read_state_condition
from core.notifications.model import UserNotification
from core.notifications.service import UserNotificationService


class FakeEnforcer:
    def __init__(self, policies, groupings):
        self.policies = policies
        self.groupings = groupings

    def get_filtered_policy(self, field_index, value):
        return [p for p in self.policies if p[field_index] == value]

    def get_filtered_named_grouping_policy(self, _ptype, field_index, value):
        return [g for g in self.groupings if g[field_index] == value]


@pytest.fixture
def enforcer(monkeypatch):
    fake = FakeEnforcer(policies=[], groupings=[])
    monkeypatch.setattr(user_functions, "_get_casbin_enforcer", AsyncMock(return_value=fake))
    return fake


class TestEntityAdminUserIds:
    async def test_collects_direct_and_role_admins_but_not_super_admins(self, enforcer):
        enforcer.policies = [
            ["user:u1", "resource:r1", "admin"],
            ["user:u2", "resource:r1", "write"],
            ["project-admins", "project:p1", "admin"],
            ["user:u4", "resource:other", "admin"],
            ["super", "*", "admin"],
        ]
        enforcer.groupings = [["user:u3", "project-admins"], ["user:s1", "super"]]

        result = await user_functions.get_entity_admin_user_ids([("resource", "r1"), ("project", "p1")])

        assert result == {"u1", "u3"}

    async def test_super_admin_ids_follow_nested_roles(self, enforcer):
        enforcer.groupings = [["user:s1", "super"], ["platform", "super"], ["user:s2", "platform"]]

        assert await user_functions.get_super_admin_user_ids() == {"s1", "s2"}


class TestUserNotificationService:
    def requester(self, primary_id=None):
        primary_account = [SimpleNamespace(id=primary_id)] if primary_id else []
        return SimpleNamespace(id=uuid4(), primary_account=primary_account)

    async def test_queries_are_scoped_to_the_requester_and_primary_account(self):
        crud = Mock(spec=UserNotificationCRUD)
        crud.get_all = AsyncMock(return_value=[])
        primary_id = uuid4()
        requester = self.requester(primary_id)

        _ = await UserNotificationService(crud).query_all(requester, filter={"user_id": str(uuid4())})

        user_ids = crud.get_all.await_args.args[0]
        assert user_ids == [requester.id, primary_id]

    async def test_mark_read_without_ids_does_nothing(self):
        crud = Mock(spec=UserNotificationCRUD)
        crud.mark_read = AsyncMock()

        assert await UserNotificationService(crud).mark_read(self.requester(), []) == 0
        crud.mark_read.assert_not_awaited()

    async def test_mark_unread_is_scoped_to_the_requester(self):
        crud = Mock(spec=UserNotificationCRUD)
        crud.mark_unread = AsyncMock(return_value=1)
        requester = self.requester()
        notification_id = uuid4()

        assert await UserNotificationService(crud).mark_unread(requester, [notification_id]) == 1
        crud.mark_unread.assert_awaited_once_with([requester.id], [notification_id])

    async def test_unread_count_filters_on_unread(self):
        crud = Mock(spec=UserNotificationCRUD)
        crud.count = AsyncMock(return_value=3)

        assert await UserNotificationService(crud).unread_count(self.requester()) == 3
        assert crud.count.await_args.kwargs["filter"] == {"read": False}


class TestReadStateFilter:
    @pytest.mark.parametrize(
        "value,expected",
        [(True, "IS NOT NULL"), ("read", "IS NOT NULL"), (False, "IS NULL"), ("unread", "IS NULL")],
    )
    def test_read_filter_maps_to_read_at(self, value, expected):
        compiled = str(_read_state_condition(value).compile(dialect=postgresql.dialect()))
        assert compiled.endswith(f"read_at {expected}")

    def test_user_filter_cannot_widen_the_scope(self):
        crud = UserNotificationCRUD(session=Mock())
        own_id = uuid4()

        statement = crud._filtered(select(UserNotification), [own_id], {"user_id": str(uuid4())})
        where_clause = str(statement.compile(dialect=postgresql.dialect())).split("WHERE", 1)[1]
        assert where_clause.strip() == "user_notifications.user_id IN (__[POSTCOMPILE_user_id_1])"
