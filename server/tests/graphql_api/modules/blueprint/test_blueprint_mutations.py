from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_BLUEPRINT_MUTATION = """
    mutation CreateBlueprint($input: BlueprintCreateInput!) {
        createBlueprint(input: $input) {
            id
            name
            entityName
        }
    }
"""

UPDATE_BLUEPRINT_MUTATION = """
    mutation UpdateBlueprint($id: UUID!, $input: BlueprintUpdateInput!) {
        updateBlueprint(id: $id, input: $input) {
            id
            name
            entityName
        }
    }
"""

BLUEPRINT_ACTION_MUTATION = """
    mutation BlueprintAction($id: UUID!, $input: BlueprintActionInput!) {
        blueprintAction(id: $id, input: $input) {
            id
            name
            entityName
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestBlueprintMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.blueprint.mutations.get_blueprint_service")
    async def test_create_blueprint_returns_created_blueprint(
        self,
        mock_get_service,
        mock_blueprint_service,
        mocked_blueprint,
        mocked_user,
    ):
        mock_blueprint_service.create_blueprint = AsyncMock(return_value=mocked_blueprint)
        mock_get_service.return_value = mock_blueprint_service

        result = await schema.execute(
            CREATE_BLUEPRINT_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Blueprint",
                    "templateIds": [str(uuid4())],
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createBlueprint"] == {
            "id": str(mocked_blueprint.id),
            "name": mocked_blueprint.name,
            "entityName": "blueprint",
        }
        mock_blueprint_service.create_blueprint.assert_awaited_once_with(blueprint=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.blueprint.mutations.get_blueprint_service")
    async def test_create_blueprint_requires_authentication(
        self,
        mock_get_service,
        mock_blueprint_service,
        mocked_user,
    ):
        mock_blueprint_service.create_blueprint = AsyncMock()
        mock_get_service.return_value = mock_blueprint_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_BLUEPRINT_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Blueprint",
                    "templateIds": [str(uuid4())],
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createBlueprint"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_blueprint_service.create_blueprint.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.blueprint.mutations.get_blueprint_service")
    async def test_update_blueprint_denies_without_edit_action(
        self,
        mock_get_service,
        mock_blueprint_service,
        mocked_user,
    ):
        blueprint_id = uuid4()
        mock_blueprint_service.get_actions = AsyncMock(return_value=[])
        mock_blueprint_service.update_blueprint = AsyncMock()
        mock_get_service.return_value = mock_blueprint_service

        result = await schema.execute(
            UPDATE_BLUEPRINT_MUTATION,
            variable_values={
                "id": str(blueprint_id),
                "input": {
                    "name": "Updated Blueprint",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateBlueprint"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_blueprint_service.get_actions.assert_awaited_once_with(blueprint_id=blueprint_id, requester=mocked_user)
        mock_blueprint_service.update_blueprint.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.blueprint.mutations.get_blueprint_service")
    async def test_update_blueprint_returns_updated_blueprint(
        self,
        mock_get_service,
        mock_blueprint_service,
        mocked_blueprint,
        mocked_user,
    ):
        blueprint_id = uuid4()
        mock_blueprint_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_blueprint_service.update_blueprint = AsyncMock(return_value=mocked_blueprint)
        mock_get_service.return_value = mock_blueprint_service

        result = await schema.execute(
            UPDATE_BLUEPRINT_MUTATION,
            variable_values={
                "id": str(blueprint_id),
                "input": {
                    "name": "Updated Blueprint",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateBlueprint"] == {
            "id": str(mocked_blueprint.id),
            "name": mocked_blueprint.name,
            "entityName": "blueprint",
        }
        mock_blueprint_service.get_actions.assert_awaited_once_with(blueprint_id=blueprint_id, requester=mocked_user)
        mock_blueprint_service.update_blueprint.assert_awaited_once_with(
            blueprint_id=str(blueprint_id),
            blueprint=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.blueprint.mutations.get_blueprint_service")
    async def test_blueprint_action_raises_on_invalid_action(
        self,
        mock_get_service,
        mock_blueprint_service,
        mocked_user,
    ):
        blueprint_id = uuid4()
        mock_blueprint_service.get_actions = AsyncMock()
        mock_blueprint_service.patch_action = AsyncMock()
        mock_get_service.return_value = mock_blueprint_service

        result = await schema.execute(
            BLUEPRINT_ACTION_MUTATION,
            variable_values={
                "id": str(blueprint_id),
                "input": {
                    "action": "unknown",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["blueprintAction"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_blueprint_service.get_actions.assert_not_awaited()
        mock_blueprint_service.patch_action.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.blueprint.mutations.get_blueprint_service")
    async def test_blueprint_action_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mock_blueprint_service,
        mocked_user,
    ):
        blueprint_id = uuid4()
        mock_blueprint_service.get_actions = AsyncMock(return_value=[])
        mock_blueprint_service.patch_action = AsyncMock()
        mock_get_service.return_value = mock_blueprint_service

        result = await schema.execute(
            BLUEPRINT_ACTION_MUTATION,
            variable_values={
                "id": str(blueprint_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["blueprintAction"] is None
        assert result.errors is not None
        assert any("Access denied for action disable" in error.message for error in result.errors)
        mock_blueprint_service.get_actions.assert_awaited_once_with(blueprint_id=blueprint_id, requester=mocked_user)
        mock_blueprint_service.patch_action.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.blueprint.mutations.get_blueprint_service")
    async def test_blueprint_action_returns_updated_blueprint(
        self,
        mock_get_service,
        mock_blueprint_service,
        mocked_blueprint,
        mocked_user,
    ):
        blueprint_id = uuid4()
        mock_blueprint_service.get_actions = AsyncMock(return_value=[ModelActions.DISABLE.value])
        mock_blueprint_service.patch_action = AsyncMock(return_value=mocked_blueprint)
        mock_get_service.return_value = mock_blueprint_service

        result = await schema.execute(
            BLUEPRINT_ACTION_MUTATION,
            variable_values={
                "id": str(blueprint_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["blueprintAction"] == {
            "id": str(mocked_blueprint.id),
            "name": mocked_blueprint.name,
            "entityName": "blueprint",
        }
        mock_blueprint_service.patch_action.assert_awaited_once_with(
            blueprint_id=str(blueprint_id),
            body=ANY,
            requester=mocked_user,
        )
