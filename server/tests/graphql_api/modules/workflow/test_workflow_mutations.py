from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from graphql_api.schema import schema

UPDATE_WORKFLOW_MUTATION = """
    mutation UpdateWorkflow($id: UUID!, $input: WorkflowUpdateInput!) {
        updateWorkflow(id: $id, input: $input) {
            id
            status
            steps {
                id
                resolvedVariables
            }
        }
    }
"""

DELETE_WORKFLOW_MUTATION = """
    mutation DeleteWorkflow($id: UUID!) {
        deleteWorkflow(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestWorkflowMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.workflow.mutations.get_workflow_service")
    async def test_update_workflow_returns_updated(
        self,
        mock_get_service,
        mock_workflow_service,
        mocked_workflow,
        mocked_workflow_step,
        mocked_user,
    ):
        mock_workflow_service.get_actions = AsyncMock(return_value=["edit"])
        mock_workflow_service.update_with_steps_orm = AsyncMock(return_value=mocked_workflow)
        mock_get_service.return_value = mock_workflow_service

        result = await schema.execute(
            UPDATE_WORKFLOW_MUTATION,
            variable_values={
                "id": str(mocked_workflow.id),
                "input": {
                    "steps": [
                        {
                            "id": str(mocked_workflow_step.id),
                            "resolvedVariables": {"foo": "bar"},
                            "integrationIds": [str(uuid4())],
                        }
                    ]
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateWorkflow"]["id"] == str(mocked_workflow.id)
        mock_workflow_service.get_actions.assert_awaited_once_with(
            workflow_id=mocked_workflow.id, requester=mocked_user
        )
        mock_workflow_service.update_with_steps_orm.assert_awaited_once()
        assert mock_workflow_service.update_with_steps_orm.await_args
        call_kwargs = mock_workflow_service.update_with_steps_orm.await_args.kwargs
        assert call_kwargs["workflow_id"] == mocked_workflow.id
        assert call_kwargs["requester"] == mocked_user
        request = call_kwargs["request"]
        assert request.steps is not None
        assert len(request.steps) == 1
        assert request.steps[0].id == mocked_workflow_step.id
        assert request.steps[0].resolved_variables == {"foo": "bar"}

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workflow.mutations.get_workflow_service")
    async def test_update_workflow_requires_authentication(
        self,
        mock_get_service,
        mock_workflow_service,
        mocked_user,
    ):
        mock_workflow_service.get_actions = AsyncMock()
        mock_workflow_service.update_with_steps_orm = AsyncMock()
        mock_get_service.return_value = mock_workflow_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            UPDATE_WORKFLOW_MUTATION,
            variable_values={
                "id": str(uuid4()),
                "input": {"steps": []},
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["updateWorkflow"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_workflow_service.get_actions.assert_not_awaited()
        mock_workflow_service.update_with_steps_orm.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workflow.mutations.get_workflow_service")
    async def test_update_workflow_denies_without_edit_action(
        self,
        mock_get_service,
        mock_workflow_service,
        mocked_user,
    ):
        workflow_id = uuid4()
        mock_workflow_service.get_actions = AsyncMock(return_value=[])
        mock_workflow_service.update_with_steps_orm = AsyncMock()
        mock_get_service.return_value = mock_workflow_service

        result = await schema.execute(
            UPDATE_WORKFLOW_MUTATION,
            variable_values={
                "id": str(workflow_id),
                "input": {"steps": []},
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateWorkflow"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_workflow_service.get_actions.assert_awaited_once_with(workflow_id=workflow_id, requester=mocked_user)
        mock_workflow_service.update_with_steps_orm.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workflow.mutations.get_workflow_service")
    async def test_delete_workflow_denies_without_delete_action(
        self,
        mock_get_service,
        mock_workflow_service,
        mocked_user,
    ):
        workflow_id = uuid4()
        mock_workflow_service.get_actions = AsyncMock(return_value=[])
        mock_workflow_service.delete = AsyncMock()
        mock_get_service.return_value = mock_workflow_service

        result = await schema.execute(
            DELETE_WORKFLOW_MUTATION,
            variable_values={"id": str(workflow_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteWorkflow"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_workflow_service.get_actions.assert_awaited_once_with(workflow_id=workflow_id, requester=mocked_user)
        mock_workflow_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workflow.mutations.get_workflow_service")
    async def test_delete_workflow_returns_true(
        self,
        mock_get_service,
        mock_workflow_service,
        mocked_user,
    ):
        workflow_id = uuid4()
        mock_workflow_service.get_actions = AsyncMock(return_value=["delete"])
        mock_workflow_service.delete = AsyncMock()
        mock_get_service.return_value = mock_workflow_service

        result = await schema.execute(
            DELETE_WORKFLOW_MUTATION,
            variable_values={"id": str(workflow_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteWorkflow": True}
        mock_workflow_service.get_actions.assert_awaited_once_with(workflow_id=workflow_id, requester=mocked_user)
        mock_workflow_service.delete.assert_awaited_once_with(workflow_id=workflow_id, requester=mocked_user)
