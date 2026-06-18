from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_RESOURCE_MUTATION = """
    mutation CreateResource($input: ResourceCreateInput!) {
        createResource(input: $input) {
            id
            name
            description
        }
    }
"""

UPDATE_RESOURCE_MUTATION = """
    mutation UpdateResource($id: UUID!, $input: ResourceUpdateInput!) {
        updateResource(id: $id, input: $input) {
            id
            name
            description
        }
    }
"""

RESOURCE_ACTION_MUTATION = """
    mutation ResourceAction($id: UUID!, $input: ResourceActionInput!) {
        resourceAction(id: $id, input: $input) {
            id
            name
        }
    }
"""

DELETE_RESOURCE_MUTATION = """
    mutation DeleteResource($id: UUID!) {
        deleteResource(id: $id)
    }
"""

CASCADE_DESTROY_RESOURCE_MUTATION = """
    mutation CascadeDestroyResource($id: UUID!) {
        cascadeDestroyResource(id: $id) {
            id
        }
    }
"""


def make_context(user, session=None):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": session or Mock(), "user": user, "request": request}


class TestResourceMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_create_resource_returns_created_resource(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_resource,
        mocked_user,
    ):
        mock_resource_service.create_resource = AsyncMock(return_value=mocked_resource)
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            CREATE_RESOURCE_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Resource",
                    "templateId": str(mocked_resource.template_id),
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createResource"] == {
            "id": str(mocked_resource.id),
            "name": mocked_resource.name,
            "description": mocked_resource.description,
        }
        mock_resource_service.create_resource.assert_awaited_once_with(resource=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_create_resource_requires_authentication(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        mock_resource_service.create_resource = AsyncMock()
        mock_get_service.return_value = mock_resource_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_RESOURCE_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Resource",
                    "templateId": str(uuid4()),
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createResource"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_resource_service.create_resource.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_update_resource_denies_without_edit_action(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        resource_id = uuid4()
        mock_resource_service.get_actions = AsyncMock(return_value=[])
        mock_resource_service.update_resource = AsyncMock()
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            UPDATE_RESOURCE_MUTATION,
            variable_values={
                "id": str(resource_id),
                "input": {
                    "name": "Updated Resource",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateResource"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_resource_service.get_actions.assert_awaited_once_with(resource_id=resource_id, requester=mocked_user)
        mock_resource_service.update_resource.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_update_resource_returns_updated_resource(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_resource,
        mocked_user,
    ):
        resource_id = uuid4()
        mock_resource_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_resource_service.update_resource = AsyncMock(return_value=mocked_resource)
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            UPDATE_RESOURCE_MUTATION,
            variable_values={
                "id": str(resource_id),
                "input": {
                    "name": "Updated Resource",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateResource"] == {
            "id": str(mocked_resource.id),
            "name": mocked_resource.name,
            "description": mocked_resource.description,
        }
        mock_resource_service.get_actions.assert_awaited_once_with(resource_id=resource_id, requester=mocked_user)
        mock_resource_service.update_resource.assert_awaited_once_with(
            resource_id=str(resource_id),
            resource=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_resource_action_raises_on_invalid_action(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        resource_id = uuid4()
        mock_resource_service.get_actions = AsyncMock()
        mock_resource_service.patch_action_resource = AsyncMock()
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            RESOURCE_ACTION_MUTATION,
            variable_values={
                "id": str(resource_id),
                "input": {
                    "action": "unknown",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["resourceAction"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_resource_service.get_actions.assert_not_awaited()
        mock_resource_service.patch_action_resource.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_resource_action_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        resource_id = uuid4()
        mock_resource_service.get_actions = AsyncMock(return_value=[])
        mock_resource_service.patch_action_resource = AsyncMock()
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            RESOURCE_ACTION_MUTATION,
            variable_values={
                "id": str(resource_id),
                "input": {
                    "action": ModelActions.APPROVE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["resourceAction"] is None
        assert result.errors is not None
        assert any("Access denied for action approve" in error.message for error in result.errors)
        mock_resource_service.get_actions.assert_awaited_once_with(resource_id=resource_id, requester=mocked_user)
        mock_resource_service.patch_action_resource.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_resource_action_returns_updated_resource(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_resource,
        mocked_user,
    ):
        resource_id = uuid4()
        mock_resource_service.get_actions = AsyncMock(return_value=[ModelActions.APPROVE.value])
        mock_resource_service.patch_action_resource = AsyncMock(return_value=mocked_resource)
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            RESOURCE_ACTION_MUTATION,
            variable_values={
                "id": str(resource_id),
                "input": {
                    "action": ModelActions.APPROVE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["resourceAction"] == {
            "id": str(mocked_resource.id),
            "name": mocked_resource.name,
        }
        mock_resource_service.get_actions.assert_awaited_once_with(resource_id=resource_id, requester=mocked_user)
        mock_resource_service.patch_action_resource.assert_awaited_once()
        assert mock_resource_service.patch_action_resource.await_args
        call_kwargs = mock_resource_service.patch_action_resource.await_args.kwargs
        assert call_kwargs["resource_id"] == str(resource_id)
        assert call_kwargs["requester"] == mocked_user
        assert call_kwargs["body"].action == ModelActions.APPROVE.value

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_delete_resource_denies_without_delete_action(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        resource_id = uuid4()
        mock_resource_service.get_actions = AsyncMock(return_value=[])
        mock_resource_service.delete = AsyncMock()
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            DELETE_RESOURCE_MUTATION,
            variable_values={"id": str(resource_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteResource"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_resource_service.get_actions.assert_awaited_once_with(resource_id=resource_id, requester=mocked_user)
        mock_resource_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_delete_resource_returns_true(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        resource_id = uuid4()
        mock_resource_service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        mock_resource_service.delete = AsyncMock()
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            DELETE_RESOURCE_MUTATION,
            variable_values={"id": str(resource_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteResource": True}
        mock_resource_service.get_actions.assert_awaited_once_with(resource_id=resource_id, requester=mocked_user)
        mock_resource_service.delete.assert_awaited_once_with(resource_id=str(resource_id), requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_cascade_destroy_service")
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_cascade_destroy_resource_denies_without_action(
        self,
        mock_get_resource_service,
        mock_get_cascade_destroy_service,
        mock_resource_service,
        mocked_user,
    ):
        resource_id = uuid4()
        mock_resource_service.get_actions = AsyncMock(return_value=[])
        mock_get_resource_service.return_value = mock_resource_service

        result = await schema.execute(
            CASCADE_DESTROY_RESOURCE_MUTATION,
            variable_values={"id": str(resource_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["cascadeDestroyResource"] is None
        assert result.errors is not None
        assert any("Access denied for action cascade_destroy" in error.message for error in result.errors)
        mock_resource_service.get_actions.assert_awaited_once_with(resource_id=resource_id, requester=mocked_user)
        mock_get_cascade_destroy_service.assert_not_called()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.mutations.get_cascade_destroy_service")
    @patch("graphql_api.modules.resource.mutations.get_resource_service")
    async def test_cascade_destroy_resource_returns_workflow(
        self,
        mock_get_resource_service,
        mock_get_cascade_destroy_service,
        mock_resource_service,
        mocked_workflow,
        mocked_user,
    ):
        resource_id = uuid4()
        session = Mock()
        session.get = AsyncMock(return_value=mocked_workflow)
        workflow_response = SimpleNamespace(id=mocked_workflow.id)
        mock_resource_service.get_actions = AsyncMock(return_value=[ModelActions.CASCADE_DESTROY])
        mock_cascade_destroy_service = Mock()
        mock_cascade_destroy_service.create_cascade_destroy_workflow = AsyncMock(return_value=workflow_response)
        mock_get_resource_service.return_value = mock_resource_service
        mock_get_cascade_destroy_service.return_value = mock_cascade_destroy_service

        result = await schema.execute(
            CASCADE_DESTROY_RESOURCE_MUTATION,
            variable_values={"id": str(resource_id)},
            context_value=make_context(mocked_user, session=session),
        )

        assert result.errors is None
        assert result.data == {"cascadeDestroyResource": {"id": str(mocked_workflow.id)}}
        mock_resource_service.get_actions.assert_awaited_once_with(resource_id=resource_id, requester=mocked_user)
        mock_get_cascade_destroy_service.assert_called_once_with(session=session)
        mock_cascade_destroy_service.create_cascade_destroy_workflow.assert_awaited_once_with(
            resource_id=resource_id,
            requester=mocked_user,
        )
        session.get.assert_awaited_once_with(type(mocked_workflow), mocked_workflow.id)
