from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_TEMPLATE_MUTATION = """
    mutation CreateTemplate($input: TemplateCreateInput!) {
        createTemplate(input: $input) {
            id
            name
            template
            entityName
        }
    }
"""

UPDATE_TEMPLATE_MUTATION = """
    mutation UpdateTemplate($id: UUID!, $input: TemplateUpdateInput!) {
        updateTemplate(id: $id, input: $input) {
            id
            name
            template
            entityName
        }
    }
"""

TEMPLATE_ACTION_MUTATION = """
    mutation TemplateAction($id: UUID!, $input: TemplateActionInput!) {
        templateAction(id: $id, input: $input) {
            id
            name
            template
            entityName
        }
    }
"""

DELETE_TEMPLATE_MUTATION = """
    mutation DeleteTemplate($id: UUID!) {
        deleteTemplate(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestTemplateMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_create_template_returns_created_template(
        self,
        mock_get_service,
        mock_template_service,
        mocked_template,
        mocked_user,
    ):
        mock_template_service.create_template = AsyncMock(return_value=mocked_template)
        mock_get_service.return_value = mock_template_service

        result = await schema.execute(
            CREATE_TEMPLATE_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Template",
                    "template": "graphql_template",
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createTemplate"] == {
            "id": str(mocked_template.id),
            "name": mocked_template.name,
            "template": mocked_template.template,
            "entityName": "template",
        }
        mock_template_service.create_template.assert_awaited_once_with(template=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_create_template_requires_authentication(
        self,
        mock_get_service,
        mock_template_service,
        mocked_user,
    ):
        mock_template_service.create = AsyncMock()
        mock_get_service.return_value = mock_template_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_TEMPLATE_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Template",
                    "template": "graphql_template",
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createTemplate"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_template_service.create.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_update_template_denies_without_edit_action(
        self,
        mock_get_service,
        mock_template_service,
        mocked_user,
    ):
        template_id = uuid4()
        mock_template_service.get_actions = AsyncMock(return_value=[])
        mock_template_service.update_entity = AsyncMock()
        mock_get_service.return_value = mock_template_service

        result = await schema.execute(
            UPDATE_TEMPLATE_MUTATION,
            variable_values={
                "id": str(template_id),
                "input": {
                    "name": "Updated Template",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateTemplate"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_template_service.get_actions.assert_awaited_once_with(template_id=template_id, requester=mocked_user)
        mock_template_service.update_entity.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_update_template_returns_updated_template(
        self,
        mock_get_service,
        mock_template_service,
        mocked_template,
        mocked_user,
    ):
        template_id = uuid4()
        mock_template_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_template_service.update_template = AsyncMock(return_value=mocked_template)
        mock_get_service.return_value = mock_template_service

        result = await schema.execute(
            UPDATE_TEMPLATE_MUTATION,
            variable_values={
                "id": str(template_id),
                "input": {
                    "name": "Updated Template",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateTemplate"] == {
            "id": str(mocked_template.id),
            "name": mocked_template.name,
            "template": mocked_template.template,
            "entityName": "template",
        }
        mock_template_service.get_actions.assert_awaited_once_with(template_id=template_id, requester=mocked_user)
        mock_template_service.update_template.assert_awaited_once_with(
            template_id=str(template_id),
            template=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_patch_template_action_raises_on_invalid_action(
        self,
        mock_get_service,
        mock_template_service,
        mocked_user,
    ):
        template_id = uuid4()
        mock_template_service.get_actions = AsyncMock()
        mock_template_service.patch = AsyncMock()
        mock_get_service.return_value = mock_template_service

        result = await schema.execute(
            TEMPLATE_ACTION_MUTATION,
            variable_values={
                "id": str(template_id),
                "input": {
                    "action": "unknown",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["templateAction"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_template_service.get_actions.assert_not_awaited()
        mock_template_service.patch.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_template_action_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mock_template_service,
        mocked_user,
    ):
        template_id = uuid4()
        mock_template_service.get_actions = AsyncMock(return_value=[])
        mock_template_service.patch = AsyncMock()
        mock_get_service.return_value = mock_template_service

        result = await schema.execute(
            TEMPLATE_ACTION_MUTATION,
            variable_values={
                "id": str(template_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["templateAction"] is None
        assert result.errors is not None
        assert any("Access denied for action disable" in error.message for error in result.errors)
        mock_template_service.get_actions.assert_awaited_once_with(template_id=template_id, requester=mocked_user)
        mock_template_service.patch.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_template_action_returns_updated_template(
        self,
        mock_get_service,
        mock_template_service,
        mocked_template,
        mocked_user,
    ):
        template_id = uuid4()
        mock_template_service.get_actions = AsyncMock(return_value=[ModelActions.DISABLE.value])
        mock_template_service.patch = AsyncMock(return_value=mocked_template)
        mock_get_service.return_value = mock_template_service

        result = await schema.execute(
            TEMPLATE_ACTION_MUTATION,
            variable_values={
                "id": str(template_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["templateAction"] == {
            "id": str(mocked_template.id),
            "name": mocked_template.name,
            "template": mocked_template.template,
            "entityName": "template",
        }
        mock_template_service.get_actions.assert_awaited_once_with(template_id=template_id, requester=mocked_user)
        mock_template_service.patch.assert_awaited_once()
        assert mock_template_service.patch.await_args
        call_kwargs = mock_template_service.patch.await_args.kwargs
        assert call_kwargs["template_id"] == str(template_id)
        assert call_kwargs["requester"] == mocked_user
        assert call_kwargs["body"].action == ModelActions.DISABLE.value

    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_delete_template_denies_without_delete_action(
        self,
        mock_get_service,
        mock_template_service,
        mocked_user,
    ):
        template_id = uuid4()
        mock_template_service.get_actions = AsyncMock(return_value=[])
        mock_template_service.delete = AsyncMock()
        mock_get_service.return_value = mock_template_service

        result = await schema.execute(
            DELETE_TEMPLATE_MUTATION,
            variable_values={"id": str(template_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteTemplate"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_template_service.get_actions.assert_awaited_once_with(template_id=template_id, requester=mocked_user)
        mock_template_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.template.mutations.get_template_service")
    async def test_delete_template_returns_true(
        self,
        mock_get_service,
        mock_template_service,
        mocked_user,
    ):
        template_id = uuid4()
        mock_template_service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        mock_template_service.delete = AsyncMock()
        mock_get_service.return_value = mock_template_service

        result = await schema.execute(
            DELETE_TEMPLATE_MUTATION,
            variable_values={"id": str(template_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteTemplate": True}
        mock_template_service.get_actions.assert_awaited_once_with(template_id=template_id, requester=mocked_user)
        mock_template_service.delete.assert_awaited_once_with(template_id=str(template_id), requester=mocked_user)
