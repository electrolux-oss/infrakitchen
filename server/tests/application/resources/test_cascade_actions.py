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
