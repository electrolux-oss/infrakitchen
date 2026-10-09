from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

import application.tools.notification_manager as notification_manager_module
from application.tools.notification_manager import _route_notification_event
from core.constants.model import EventType
from core.notifications.controller import NotificationEvent


def user(slack_id: str | None = None, deactivated: bool = False):
    return SimpleNamespace(id=uuid4(), meta={"slack_id": slack_id} if slack_id else {}, deactivated=deactivated)


@pytest.fixture
def resource():
    return SimpleNamespace(id=uuid4(), name="orders-db", project_id=None, project=None)


@pytest.fixture
def routing(monkeypatch, resource):
    """Wire the router to in-memory users, approvers, super admins and preferences."""
    state = SimpleNamespace(users=[], approver_ids=set(), super_admin_ids=set(), preferences=[], sent=[])

    resource_service = Mock(get_by_id=AsyncMock(return_value=resource))

    async def query_users(filter, fields=None):
        ids = set(filter["id__in"])
        return [u for u in state.users if u.id in ids]

    async def query_preferences(filter, fields=None):
        ids = set(filter["user_id__in"])
        return [p for p in state.preferences if p.user_id in ids and p.event_type == filter["event_type"]]

    async def approver_ids(_resource):
        return {str(i) for i in state.approver_ids}

    async def super_admin_ids():
        return {str(i) for i in state.super_admin_ids}

    async def dispatch(body):
        state.sent.append(body)

    monkeypatch.setattr(notification_manager_module, "get_resource_service", lambda session: resource_service)
    monkeypatch.setattr(
        notification_manager_module,
        "get_user_service",
        lambda session: Mock(query_all=AsyncMock(side_effect=query_users)),
    )
    monkeypatch.setattr(
        notification_manager_module,
        "get_notification_preference_service",
        lambda session: Mock(query_all=AsyncMock(side_effect=query_preferences)),
    )
    monkeypatch.setattr(notification_manager_module, "get_resource_approver_ids", approver_ids)
    monkeypatch.setattr(notification_manager_module, "get_super_admin_user_ids", super_admin_ids)
    monkeypatch.setattr(notification_manager_module, "_dispatch_notification", dispatch)
    return state


def approval_event(resource, requester_id):
    return NotificationEvent(
        event_type=EventType.APPROVAL_REQUIRED,
        entity_type="resource",
        entity_id=str(resource.id),
        title=f"Approval required: {resource.name}",
        status="warning",
        message="waiting for approval",
        metadata={"requester_id": str(requester_id)},
    )


def recipients(sent, provider):
    return {body["user_id"] for body in sent if body["provider"] == provider}


class TestApprovalRouting:
    async def test_notifies_approvers_in_app_but_not_the_requester(self, routing, resource):
        requester, owner, admin = user(), user(), user()
        routing.users = [requester, owner, admin]
        routing.approver_ids = {requester.id, owner.id, admin.id}

        await _route_notification_event(approval_event(resource, requester.id), Mock())

        assert recipients(routing.sent, "in_app") == {str(owner.id), str(admin.id)}
        assert recipients(routing.sent, "slack") == set()
        assert all(body["entity_name"] == "orders-db" for body in routing.sent)
        assert all(body["event_type"] == "approval_required" for body in routing.sent)

    async def test_super_admins_are_not_notified_when_other_approvers_exist(self, routing, resource):
        requester, owner, super_admin = user(), user(), user()
        routing.users = [requester, owner, super_admin]
        routing.approver_ids = {owner.id}
        routing.super_admin_ids = {super_admin.id}

        await _route_notification_event(approval_event(resource, requester.id), Mock())

        assert recipients(routing.sent, "in_app") == {str(owner.id)}

    async def test_falls_back_to_super_admins_when_requester_is_the_only_approver(self, routing, resource):
        requester, super_admin = user(), user()
        routing.users = [requester, super_admin]
        routing.approver_ids = {requester.id}
        routing.super_admin_ids = {requester.id, super_admin.id}

        await _route_notification_event(approval_event(resource, requester.id), Mock())

        assert recipients(routing.sent, "in_app") == {str(super_admin.id)}

    async def test_deactivated_approvers_are_skipped(self, routing, resource):
        requester, active, inactive = user(), user(), user(deactivated=True)
        routing.users = [requester, active, inactive]
        routing.approver_ids = {active.id, inactive.id}

        await _route_notification_event(approval_event(resource, requester.id), Mock())

        assert recipients(routing.sent, "in_app") == {str(active.id)}

    async def test_slack_only_for_approvers_who_opted_in(self, routing, resource):
        requester, opted_in, not_opted_in = user(), user(slack_id="U1"), user(slack_id="U2")
        routing.users = [requester, opted_in, not_opted_in]
        routing.approver_ids = {opted_in.id, not_opted_in.id}
        routing.preferences = [
            SimpleNamespace(user_id=opted_in.id, event_type=EventType.APPROVAL_REQUIRED, channels=["SLACK"]),
            SimpleNamespace(user_id=not_opted_in.id, event_type=EventType.APPROVAL_REQUIRED, channels=["IN_APP"]),
        ]

        await _route_notification_event(approval_event(resource, requester.id), Mock())

        assert recipients(routing.sent, "in_app") == {str(opted_in.id), str(not_opted_in.id)}
        slack = [body for body in routing.sent if body["provider"] == "slack"]
        assert [(body["user_id"], body["channel"]) for body in slack] == [(str(opted_in.id), "U1")]


def approval_result_event(resource, recipient_id, approver_id):
    return NotificationEvent(
        event_type=EventType.APPROVAL_RESULT,
        entity_type="resource",
        entity_id=str(resource.id),
        title="Change approved",
        status="success",
        message="approved",
        metadata={"recipient_id": str(recipient_id), "approver_id": str(approver_id)},
    )


class TestApprovalResultRouting:
    async def test_notifies_the_change_requester(self, routing, resource):
        requester, approver, other_approver = user(slack_id="U1"), user(), user()
        routing.users = [requester, approver, other_approver]
        routing.approver_ids = {approver.id, other_approver.id}
        routing.preferences = [
            SimpleNamespace(user_id=requester.id, event_type=EventType.APPROVAL_RESULT, channels=["SLACK"]),
        ]

        await _route_notification_event(approval_result_event(resource, requester.id, approver.id), Mock())

        assert recipients(routing.sent, "in_app") == {str(requester.id)}
        assert recipients(routing.sent, "slack") == {str(requester.id)}

    async def test_self_approval_notifies_nobody(self, routing, resource):
        requester = user()
        routing.users = [requester]

        await _route_notification_event(approval_result_event(resource, requester.id, requester.id), Mock())

        assert routing.sent == []
