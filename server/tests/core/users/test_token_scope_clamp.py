import os
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import casbin
import pytest

import core.casbin.enforcer as enforcer_module
from application.projects.functions import get_project_actions, get_project_permissions, merge_project_permissions
from core.constants.model import ModelStatus
from core.personal_access_tokens.scopes import set_current_token_scopes
from core.users.functions import (
    user_api_permission,
    user_entity_ids,
    user_entity_permissions,
    user_has_access_to_entity,
    user_is_super_admin,
)

MODEL_PATH = os.path.join(os.path.dirname(enforcer_module.__file__), "model.conf")

RESOURCE = str(uuid4())


def make_user() -> Any:
    return SimpleNamespace(id=uuid4(), deactivated=False, primary_account=[])


@pytest.fixture
def enforcer(monkeypatch):
    real_enforcer = casbin.AsyncEnforcer(MODEL_PATH)
    monkeypatch.setattr("core.users.functions._get_casbin_enforcer", AsyncMock(return_value=real_enforcer))
    return real_enforcer


@pytest.fixture
async def admin_user(enforcer):
    """A user with admin on every resource, like a super admin."""
    user = make_user()
    await enforcer.add_policy(f"user:{user.id}", "resource:*", "admin")
    return user


@pytest.fixture(autouse=True)
def reset_scopes():
    set_current_token_scopes(None)
    yield
    set_current_token_scopes(None)


@pytest.mark.asyncio
async def test_unscoped_request_keeps_full_permissions(admin_user):
    assert await user_entity_permissions(admin_user, RESOURCE, "resource") == ["read", "write", "admin"]
    assert await user_has_access_to_entity(admin_user, RESOURCE, "admin", "resource") is True
    assert await user_entity_ids(admin_user, "resource", "admin") is None


@pytest.mark.asyncio
async def test_write_scope_never_grants_admin(admin_user):
    set_current_token_scopes(["write:resource"])

    assert await user_entity_permissions(admin_user, RESOURCE, "resource") == ["read", "write"]
    assert await user_has_access_to_entity(admin_user, RESOURCE, "write", "resource") is True
    assert await user_has_access_to_entity(admin_user, RESOURCE, "admin", "resource") is False
    assert await user_entity_ids(admin_user, "resource", "admin") == set()


@pytest.mark.asyncio
async def test_read_scope_drops_write(admin_user):
    set_current_token_scopes(["read:resource"])

    assert await user_entity_permissions(admin_user, RESOURCE, "resource") == ["read"]
    assert await user_has_access_to_entity(admin_user, RESOURCE, "read", "resource") is True
    assert await user_has_access_to_entity(admin_user, RESOURCE, "write", "resource") is False
    assert await user_entity_ids(admin_user, "resource", "write") == set()


@pytest.mark.asyncio
async def test_scope_for_other_entity_grants_nothing(admin_user):
    set_current_token_scopes(["write:template"])

    assert await user_entity_permissions(admin_user, RESOURCE, "resource") == []
    assert await user_has_access_to_entity(admin_user, RESOURCE, "read", "resource") is False
    assert await user_entity_ids(admin_user, "resource", "read") == set()


@pytest.mark.asyncio
async def test_scope_cannot_exceed_role(enforcer):
    user = make_user()
    await enforcer.add_policy(f"user:{user.id}", f"resource:{RESOURCE}", "read")
    set_current_token_scopes(["write:resource"])

    assert await user_entity_permissions(user, RESOURCE, "resource") == ["read"]
    assert await user_has_access_to_entity(user, RESOURCE, "write", "resource") is False


@pytest.mark.asyncio
async def test_scoped_token_is_never_super_admin():
    set_current_token_scopes(["write:resource"])
    assert await user_is_super_admin(make_user()) is False  # pyright: ignore[reportArgumentType]


@pytest.mark.asyncio
async def test_api_permission_clamped_to_scopes(enforcer):
    user = make_user()
    await enforcer.add_policy(f"user:{user.id}", "api:project", "admin")

    assert await user_api_permission(user, "project") == {"api:project": "admin"}
    set_current_token_scopes(["write:project"])
    assert await user_api_permission(user, "project") == {"api:project": "write"}
    set_current_token_scopes(["read:resource"])
    assert await user_api_permission(user, "project") is None


def owned_project(user: Any) -> Any:
    return SimpleNamespace(id=uuid4(), owners=[SimpleNamespace(id=user.id)])


@pytest.mark.asyncio
async def test_project_owner_inheritance_clamped_to_scopes(enforcer):
    user = make_user()
    project = owned_project(user)

    assert await merge_project_permissions(user, [], project, "resource") == ["admin", "read", "write"]
    set_current_token_scopes(["write:resource"])
    assert await merge_project_permissions(user, [], project, "resource") == ["read", "write"]
    assert await merge_project_permissions(user, [], project, "executor") == []
    assert await get_project_permissions(user, project) == set()


@pytest.mark.asyncio
async def test_scoped_project_owner_gets_no_project_admin_actions(enforcer):
    user = make_user()
    project = owned_project(user)
    set_current_token_scopes(["write:project"])

    assert await get_project_actions(user, project.id, ModelStatus.ENABLED, project) == []
