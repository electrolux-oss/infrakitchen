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
