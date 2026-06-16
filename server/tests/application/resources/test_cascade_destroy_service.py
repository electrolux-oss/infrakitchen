from datetime import datetime
from typing import cast
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.resources.cascade_destroy_service import CascadeDestroyService
from application.resources.model import Resource
from application.workflows.schema import WorkflowResponse, WorkflowStepResponse
from core.constants.model import ModelState, ModelStatus, WorkflowAction
from core.errors import AccessDenied, EntityNotFound


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_resource(
    *,
    state: ModelState = ModelState.PROVISIONED,
    status: ModelStatus = ModelStatus.DONE,
) -> Resource:
    r = Resource(
        id=uuid4(),
        name="res",
        template_id=uuid4(),
        template=None,
        source_code_version_id=None,
        storage_id=None,
        storage_path=None,
        integration_ids=[],
        secret_ids=[],
        creator=None,
        created_by=uuid4(),
        revision_number=1,
        parents=[],
        children=[],
        abstract=False,
        variables=[],
        outputs=[],
        dependency_tags=[],
        dependency_config=[],
        labels=[],
        description="",
        state=state,
        status=status,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    return r


def _make_workflow_response(workflow_id=None, step_resource_id=None) -> WorkflowResponse:
    wid = workflow_id or uuid4()
    step = WorkflowStepResponse(
        id=uuid4(),
        template_id=uuid4(),
        resource_id=step_resource_id or uuid4(),
        position=0,
        status=ModelStatus.PENDING,
    )
    return WorkflowResponse(
        id=wid,
        action=WorkflowAction.DESTROY,
        status=ModelStatus.PENDING,
        steps=[step],
        created_at=datetime.now(),
    )


def _make_service(resource_crud, workflow_service, event_sender=None, audit_log_handler=None):
    event_sender = event_sender or Mock()
    event_sender.send_task = AsyncMock()
    event_sender.send_event = AsyncMock()
    audit = audit_log_handler or Mock()
    audit.create_log = AsyncMock()
    return CascadeDestroyService(
        resource_crud=resource_crud,
        workflow_service=workflow_service,
        event_sender=event_sender,
        audit_log_handler=audit,
    )


def _make_row(resource: Resource, level: int) -> dict[str, object]:
    """Build a CTE row dict as returned by ResourceCRUD.get_tree_to_children."""
    return {"id": resource.id, "template_id": resource.template_id, "level": level}


def _mock_workflow_service(workflow_response: WorkflowResponse):
    ws = Mock()
    ws.create = AsyncMock(return_value=workflow_response)
    return ws


def _get_create_mock(service: CascadeDestroyService) -> AsyncMock:
    """Typed accessor for the workflow_service.create AsyncMock."""
    return cast(AsyncMock, service.workflow_service.create)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCascadeDestroyIncludesAllDescendants:
    """Every child must be included in the workflow regardless of state/status."""

    @pytest.mark.asyncio
    async def test_includes_child_in_destroy_state(self, mock_user_dto, monkeypatch):
        """Child already in DESTROY state must still be enqueued."""
        child = _make_resource(state=ModelState.DESTROY, status=ModelStatus.IN_PROGRESS)
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0), _make_row(child, 1)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        # Grant admin on both resources
        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read", "write", "admin"]),
        )

        result = await service.create_cascade_destroy_workflow(root.id, mock_user_dto)

        assert result.id == workflow_resp.id
        # Workflow was created — meaning the child was not filtered out
        _get_create_mock(service).assert_awaited_once()
        call_body = _get_create_mock(service).call_args[0][0]
        assert len(call_body["steps"]) == 2

    @pytest.mark.asyncio
    async def test_includes_child_in_destroyed_state(self, mock_user_dto, monkeypatch):
        """Child already DESTROYED+DONE must still be enqueued."""
        child = _make_resource(state=ModelState.DESTROYED, status=ModelStatus.DONE)
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0), _make_row(child, 1)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read", "write", "admin"]),
        )

        result = await service.create_cascade_destroy_workflow(root.id, mock_user_dto)

        assert result.id == workflow_resp.id
        call_body = _get_create_mock(service).call_args[0][0]
        assert len(call_body["steps"]) == 2

    @pytest.mark.asyncio
    async def test_includes_child_with_approval_pending(self, mock_user_dto, monkeypatch):
        """Child in APPROVAL_PENDING status must still be enqueued."""
        child = _make_resource(state=ModelState.PROVISION, status=ModelStatus.APPROVAL_PENDING)
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0), _make_row(child, 1)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read", "write", "admin"]),
        )

        await service.create_cascade_destroy_workflow(root.id, mock_user_dto)
        call_body = _get_create_mock(service).call_args[0][0]
        assert len(call_body["steps"]) == 2

    @pytest.mark.asyncio
    async def test_includes_child_with_error_status(self, mock_user_dto, monkeypatch):
        """Child in ERROR status must still be enqueued."""
        child = _make_resource(state=ModelState.PROVISION, status=ModelStatus.ERROR)
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0), _make_row(child, 1)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read", "write", "admin"]),
        )

        await service.create_cascade_destroy_workflow(root.id, mock_user_dto)
        call_body = _get_create_mock(service).call_args[0][0]
        assert len(call_body["steps"]) == 2


class TestCascadeDestroyAdminValidation:
    """Requester must hold admin on every resource in the cascade tree."""

    @pytest.mark.asyncio
    async def test_fails_when_no_admin_on_child(self, mock_user_dto, monkeypatch):
        """Fails before workflow creation when requester lacks admin on a child."""
        child = _make_resource()
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0), _make_row(child, 1)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        # Admin on root only, write on child
        async def selective_permissions(requester, resource_id, entity_name):
            if resource_id == root.id:
                return ["read", "write", "admin"]
            return ["read", "write"]

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            selective_permissions,
        )

        with pytest.raises(AccessDenied) as exc_info:
            await service.create_cascade_destroy_workflow(root.id, mock_user_dto)

        assert str(child.id) in str(exc_info.value)
        _get_create_mock(service).assert_not_awaited()

    @pytest.mark.asyncio
    async def test_fails_when_no_admin_on_root(self, mock_user_dto, monkeypatch):
        """Fails even when the user only lacks admin on root itself."""
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read", "write"]),
        )

        with pytest.raises(AccessDenied):
            await service.create_cascade_destroy_workflow(root.id, mock_user_dto)

        _get_create_mock(service).assert_not_awaited()

    @pytest.mark.asyncio
    async def test_fails_with_all_denied_ids_reported(self, mock_user_dto, monkeypatch):
        """Error message contains all resource IDs that are missing admin."""
        child1 = _make_resource()
        child2 = _make_resource()
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(
            return_value=[_make_row(root, 0), _make_row(child1, 1), _make_row(child2, 1)]
        )

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read"]),
        )

        with pytest.raises(AccessDenied) as exc_info:
            await service.create_cascade_destroy_workflow(root.id, mock_user_dto)

        error_msg = str(exc_info.value)
        assert str(root.id) in error_msg
        assert str(child1.id) in error_msg
        assert str(child2.id) in error_msg

    @pytest.mark.asyncio
    async def test_passes_with_admin_on_all_resources(self, mock_user_dto, monkeypatch):
        """Creates workflow when requester has admin on all resources."""
        child = _make_resource()
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0), _make_row(child, 1)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read", "write", "admin"]),
        )

        result = await service.create_cascade_destroy_workflow(root.id, mock_user_dto)

        assert result.id == workflow_resp.id
        _get_create_mock(service).assert_awaited_once()


class TestCascadeDestroyWorkflowStructure:
    """Workflow action, step ordering, and task dispatch must follow the DESTROY pattern."""

    @pytest.mark.asyncio
    async def test_workflow_action_is_destroy(self, mock_user_dto, monkeypatch):
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read", "write", "admin"]),
        )

        await service.create_cascade_destroy_workflow(root.id, mock_user_dto)

        call_body = _get_create_mock(service).call_args[0][0]
        assert call_body["action"] == WorkflowAction.DESTROY

    @pytest.mark.asyncio
    async def test_leaf_comes_before_root_in_steps(self, mock_user_dto, monkeypatch):
        """Leaf resource must have a lower position than the root."""
        child = _make_resource()
        root = _make_resource()

        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[_make_row(root, 0), _make_row(child, 1)])

        workflow_resp = _make_workflow_response()
        service = _make_service(resource_crud, _mock_workflow_service(workflow_resp))

        monkeypatch.setattr(
            "application.resources.cascade_destroy_service.user_entity_permissions",
            AsyncMock(return_value=["read", "write", "admin"]),
        )

        await service.create_cascade_destroy_workflow(root.id, mock_user_dto)

        call_body = _get_create_mock(service).call_args[0][0]
        steps = call_body["steps"]
        assert len(steps) == 2

        step_by_resource = {s["resource_id"]: s["position"] for s in steps}
        assert step_by_resource[str(child.id)] < step_by_resource[str(root.id)]

    @pytest.mark.asyncio
    async def test_resource_not_found_raises(self, mock_user_dto, monkeypatch):
        resource_crud = Mock()
        resource_crud.get_tree_to_children = AsyncMock(return_value=[])

        service = _make_service(resource_crud, Mock())

        with pytest.raises(EntityNotFound):
            await service.create_cascade_destroy_workflow(uuid4(), mock_user_dto)
