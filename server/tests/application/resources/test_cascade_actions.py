from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from application.resources.functions import get_resource_actions
from core.constants.model import ModelActions, ModelState, ModelStatus

CASCADES = {ModelActions.CASCADE_DRYRUN, ModelActions.CASCADE_EXECUTE}


async def _actions(mock_user_dto, monkeypatch, mock_user_permissions, state, status, has_children=True):
    mock_user_permissions(["write"], monkeypatch, "application.resources.functions.user_entity_permissions")
    return set(await get_resource_actions(mock_user_dto, uuid4(), status, state, False, has_children=has_children))


@pytest.mark.asyncio
async def test_provisioned_with_children_gets_both(mock_user_dto, monkeypatch, mock_user_permissions):
    actions = await _actions(
        mock_user_dto, monkeypatch, mock_user_permissions, ModelState.PROVISIONED, ModelStatus.DONE
    )
    assert CASCADES <= actions


@pytest.mark.asyncio
async def test_no_cascades_without_children(mock_user_dto, monkeypatch, mock_user_permissions):
    actions = await _actions(
        mock_user_dto, monkeypatch, mock_user_permissions, ModelState.PROVISIONED, ModelStatus.DONE, has_children=False
    )
    assert not CASCADES & actions


@pytest.mark.asyncio
async def test_pending_approval_can_plan_but_not_apply(mock_user_dto, monkeypatch, mock_user_permissions):
    actions = await _actions(
        mock_user_dto, monkeypatch, mock_user_permissions, ModelState.PROVISIONED, ModelStatus.APPROVAL_PENDING
    )
    assert ModelActions.CASCADE_DRYRUN in actions
    assert ModelActions.CASCADE_EXECUTE not in actions


@pytest.mark.asyncio
async def test_no_cascades_in_destroy_state(mock_user_dto, monkeypatch, mock_user_permissions):
    actions = await _actions(mock_user_dto, monkeypatch, mock_user_permissions, ModelState.DESTROY, ModelStatus.READY)
    assert ModelActions.EXECUTE in actions
    assert not CASCADES & actions


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [ModelStatus.READY, ModelStatus.APPROVAL_PENDING, ModelStatus.ERROR])
async def test_creator_can_edit_in_provision_state(mock_user_dto, monkeypatch, mock_user_permissions, status):
    mock_user_permissions([], monkeypatch, "application.resources.functions.user_entity_permissions")
    actions = await get_resource_actions(
        mock_user_dto, uuid4(), status, ModelState.PROVISION, False, created_by=mock_user_dto.id
    )
    assert ModelActions.EDIT in actions
    assert ModelActions.APPROVE not in actions


@pytest.mark.asyncio
async def test_creator_has_no_access_after_provisioning(mock_user_dto, monkeypatch, mock_user_permissions):
    mock_user_permissions([], monkeypatch, "application.resources.functions.user_entity_permissions")
    actions = await get_resource_actions(
        mock_user_dto, uuid4(), ModelStatus.DONE, ModelState.PROVISIONED, False, created_by=mock_user_dto.id
    )
    assert actions == []


@pytest.mark.asyncio
async def test_non_creator_without_permissions_cannot_edit(mock_user_dto, monkeypatch, mock_user_permissions):
    mock_user_permissions([], monkeypatch, "application.resources.functions.user_entity_permissions")
    actions = await get_resource_actions(
        mock_user_dto, uuid4(), ModelStatus.READY, ModelState.PROVISION, False, created_by=uuid4()
    )
    assert actions == []


def _mock_permissions(monkeypatch, resource_perms, project_perms, is_owner=False):
    calls: list[str] = []

    async def fake_permissions(user, entity_id, entity_name):
        calls.append(entity_name)
        return list(resource_perms if entity_name == "resource" else project_perms)

    async def fake_is_owner(requester, project):
        return is_owner

    monkeypatch.setattr("application.resources.functions.user_entity_permissions", fake_permissions)
    monkeypatch.setattr("application.resources.functions.requester_is_project_owner", fake_is_owner)
    return calls


@pytest.mark.asyncio
async def test_project_admin_with_resource_write_can_approve(mock_user_dto, monkeypatch):
    _mock_permissions(monkeypatch, ["read", "write"], ["read", "write", "admin"])
    actions = await get_resource_actions(
        mock_user_dto, uuid4(), ModelStatus.APPROVAL_PENDING, ModelState.PROVISION, False, project=MagicMock(id=uuid4())
    )
    assert ModelActions.APPROVE in actions
    assert ModelActions.REJECT in actions


@pytest.mark.asyncio
async def test_project_owner_who_created_resource_can_approve(mock_user_dto, monkeypatch):
    _mock_permissions(monkeypatch, [], [], is_owner=True)
    actions = await get_resource_actions(
        mock_user_dto,
        uuid4(),
        ModelStatus.APPROVAL_PENDING,
        ModelState.PROVISION,
        False,
        project=MagicMock(id=uuid4()),
        created_by=mock_user_dto.id,
    )
    assert ModelActions.APPROVE in actions


@pytest.mark.asyncio
async def test_project_reader_with_resource_write_cannot_approve(mock_user_dto, monkeypatch):
    _mock_permissions(monkeypatch, ["read", "write"], ["read"])
    actions = await get_resource_actions(
        mock_user_dto, uuid4(), ModelStatus.APPROVAL_PENDING, ModelState.PROVISION, False, project=MagicMock(id=uuid4())
    )
    assert ModelActions.EDIT in actions
    assert ModelActions.APPROVE not in actions


@pytest.mark.asyncio
async def test_resource_admin_skips_project_lookup(mock_user_dto, monkeypatch):
    calls = _mock_permissions(monkeypatch, ["read", "write", "admin"], [])
    actions = await get_resource_actions(
        mock_user_dto, uuid4(), ModelStatus.APPROVAL_PENDING, ModelState.PROVISION, False, project=MagicMock(id=uuid4())
    )
    assert ModelActions.APPROVE in actions
    assert calls == ["resource"]
