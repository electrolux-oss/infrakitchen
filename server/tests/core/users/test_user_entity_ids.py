import os
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import casbin
import pytest

import core.casbin.enforcer as enforcer_module
from core.errors import AccessDenied
from core.users.functions import user_entity_ids

MODEL_PATH = os.path.join(os.path.dirname(enforcer_module.__file__), "model.conf")

CLOUD_1 = str(uuid4())
CLOUD_2 = str(uuid4())


def make_user(user_id=None, deactivated=False, primary_account=None) -> Any:
    return SimpleNamespace(id=user_id or uuid4(), deactivated=deactivated, primary_account=primary_account or [])


@pytest.fixture
def enforcer(monkeypatch):
    """A real Casbin enforcer on the app model, with policies held in memory."""
    real_enforcer = casbin.AsyncEnforcer(MODEL_PATH)
    monkeypatch.setattr("core.users.functions._get_casbin_enforcer", AsyncMock(return_value=real_enforcer))
    return real_enforcer


@pytest.mark.asyncio
async def test_bug_report_only_writable_integration_returned(enforcer):
    # api read on integrations must not grant write on individual integrations
    user = make_user()
    await enforcer.add_policy(f"user:{user.id}", "api:integration", "read")
    await enforcer.add_policy(f"user:{user.id}", f"integration:{CLOUD_1}", "write")

    assert await user_entity_ids(user, "integration", "write") == {CLOUD_1}


@pytest.mark.asyncio
async def test_read_only_policy_is_excluded_for_write(enforcer):
    user = make_user()
    await enforcer.add_policy(f"user:{user.id}", f"integration:{CLOUD_1}", "read")
    await enforcer.add_policy(f"user:{user.id}", f"integration:{CLOUD_2}", "admin")

    assert await user_entity_ids(user, "integration", "write") == {CLOUD_2}
    assert await user_entity_ids(user, "integration", "read") == {CLOUD_1, CLOUD_2}


@pytest.mark.asyncio
async def test_role_grants_are_resolved(enforcer):
    user = make_user()
    await enforcer.add_grouping_policy(f"user:{user.id}", "team")
    await enforcer.add_grouping_policy("team", "platform")
    await enforcer.add_policy("platform", f"integration:{CLOUD_2}", "write")

    assert await user_entity_ids(user, "integration", "write") == {CLOUD_2}


@pytest.mark.asyncio
async def test_other_entity_types_are_ignored(enforcer):
    user = make_user()
    await enforcer.add_policy(f"user:{user.id}", f"workspace:{CLOUD_1}", "write")
    await enforcer.add_policy(f"user:{user.id}", f"integration_x:{CLOUD_2}", "write")

    assert await user_entity_ids(user, "integration", "write") == set()


@pytest.mark.asyncio
@pytest.mark.parametrize("policy_object", ["*", "integration:*"])
async def test_wildcard_means_unrestricted(enforcer, policy_object):
    user = make_user()
    await enforcer.add_grouping_policy(f"user:{user.id}", "super")
    await enforcer.add_policy("super", policy_object, "admin")

    assert await user_entity_ids(user, "integration", "write") is None


@pytest.mark.asyncio
async def test_wildcard_for_other_entity_does_not_unrestrict(enforcer):
    user = make_user()
    await enforcer.add_policy(f"user:{user.id}", "workspace:*", "admin")

    assert await user_entity_ids(user, "integration", "write") == set()


@pytest.mark.asyncio
async def test_linked_account_uses_primary_account_policies(enforcer):
    primary = make_user()
    linked = make_user(primary_account=[primary])
    await enforcer.add_policy(f"user:{primary.id}", f"integration:{CLOUD_1}", "write")

    assert await user_entity_ids(linked, "integration", "write") == {CLOUD_1}


@pytest.mark.asyncio
async def test_result_agrees_with_enforce(enforcer):
    user = make_user()
    await enforcer.add_policy(f"user:{user.id}", f"integration:{CLOUD_1}", "write")
    await enforcer.add_policy(f"user:{user.id}", f"integration:{CLOUD_2}", "read")

    ids = await user_entity_ids(user, "integration", "write")
    assert ids is not None
    for integration_id in (CLOUD_1, CLOUD_2):
        allowed = enforcer.enforce(f"user:{user.id}", f"integration:{integration_id}", "write")
        assert (integration_id in ids) == allowed


@pytest.mark.asyncio
async def test_deactivated_user_is_rejected(enforcer):
    with pytest.raises(AccessDenied):
        await user_entity_ids(make_user(deactivated=True), "integration", "write")


@pytest.mark.asyncio
async def test_unknown_action_is_rejected(enforcer):
    with pytest.raises(ValueError):
        await user_entity_ids(make_user(), "integration", "delete")
