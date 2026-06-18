from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_SOURCE_CODE_VERSION_MUTATION = """
    mutation CreateSourceCodeVersion($input: SourceCodeVersionCreateInput!) {
        createSourceCodeVersion(input: $input) {
            id
            sourceCodeFolder
            sourceCodeVersion
            description
        }
    }
"""

UPDATE_SOURCE_CODE_VERSION_MUTATION = """
    mutation UpdateSourceCodeVersion($id: UUID!, $input: SourceCodeVersionUpdateInput!) {
        updateSourceCodeVersion(id: $id, input: $input) {
            id
            sourceCodeFolder
            sourceCodeVersion
            description
        }
    }
"""

SOURCE_CODE_VERSION_ACTION_MUTATION = """
    mutation SourceCodeVersionAction($id: UUID!, $input: SourceCodeVersionActionInput!) {
        sourceCodeVersionAction(id: $id, input: $input) {
            id
            sourceCodeFolder
            sourceCodeVersion
        }
    }
"""

DELETE_SOURCE_CODE_VERSION_MUTATION = """
    mutation DeleteSourceCodeVersion($id: UUID!) {
        deleteSourceCodeVersion(id: $id)
    }
"""

UPDATE_SOURCE_CODE_VERSION_CONFIGS_MUTATION = """
    mutation UpdateSourceCodeVersionConfigs($id: UUID!, $configs: [SourceConfigUpdateItemInput!]!) {
        updateSourceCodeVersionConfigs(id: $id, configs: $configs) {
            id
            name
            required
            default
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestSourceCodeVersionMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_create_source_code_version_returns_created(
        self,
        mock_get_service,
        source_code_version,
        mocked_user,
    ):
        mock_service = Mock()
        mock_service.create_source_code_version = AsyncMock(return_value=source_code_version)
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            CREATE_SOURCE_CODE_VERSION_MUTATION,
            variable_values={
                "input": {
                    "templateId": str(uuid4()),
                    "sourceCodeId": str(uuid4()),
                    "sourceCodeVersion": "v0.1",
                    "sourceCodeFolder": "source_code_folder/test_folder",
                    "description": "Test description",
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createSourceCodeVersion"] == {
            "id": str(source_code_version.id),
            "sourceCodeFolder": source_code_version.source_code_folder,
            "sourceCodeVersion": source_code_version.source_code_version,
            "description": source_code_version.description,
        }
        mock_service.create_source_code_version.assert_awaited_once_with(source_code_version=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_create_source_code_version_requires_authentication(
        self,
        mock_get_service,
        mocked_user,
    ):
        mock_service = Mock()
        mock_service.create_source_code_version = AsyncMock()
        mock_get_service.return_value = mock_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_SOURCE_CODE_VERSION_MUTATION,
            variable_values={
                "input": {
                    "templateId": str(uuid4()),
                    "sourceCodeId": str(uuid4()),
                    "sourceCodeVersion": "v0.1",
                    "sourceCodeFolder": "source_code_folder/test_folder",
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createSourceCodeVersion"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_service.create_source_code_version.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_update_source_code_version_denies_without_edit_action(
        self,
        mock_get_service,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[])
        mock_service.update_source_code_version = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            UPDATE_SOURCE_CODE_VERSION_MUTATION,
            variable_values={
                "id": str(scv_id),
                "input": {
                    "description": "Updated description",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateSourceCodeVersion"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_service.get_actions.assert_awaited_once_with(source_code_version_id=scv_id, requester=mocked_user)
        mock_service.update_source_code_version.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_update_source_code_version_returns_updated(
        self,
        mock_get_service,
        source_code_version,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_service.update_source_code_version = AsyncMock(return_value=source_code_version)
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            UPDATE_SOURCE_CODE_VERSION_MUTATION,
            variable_values={
                "id": str(scv_id),
                "input": {
                    "description": "Updated description",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateSourceCodeVersion"] == {
            "id": str(source_code_version.id),
            "sourceCodeFolder": source_code_version.source_code_folder,
            "sourceCodeVersion": source_code_version.source_code_version,
            "description": source_code_version.description,
        }
        mock_service.get_actions.assert_awaited_once_with(source_code_version_id=scv_id, requester=mocked_user)
        mock_service.update_source_code_version.assert_awaited_once_with(
            source_code_version_id=str(scv_id),
            source_code_version=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_update_source_code_version_configs_returns_updated(
        self,
        mock_get_service,
        mocked_source_config,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_service.update_configs_orm = AsyncMock(return_value=[mocked_source_config])
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            UPDATE_SOURCE_CODE_VERSION_CONFIGS_MUTATION,
            variable_values={
                "id": str(scv_id),
                "configs": [
                    {
                        "id": str(mocked_source_config.id),
                        "required": True,
                        "default": "updated_value",
                        "frozen": False,
                        "unique": False,
                        "restricted": False,
                        "options": [],
                        "templateId": str(uuid4()),
                        "referenceTemplateId": str(uuid4()),
                        "outputConfigName": "output_one",
                    }
                ],
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateSourceCodeVersionConfigs"] == [
            {
                "id": str(mocked_source_config.id),
                "name": mocked_source_config.name,
                "required": mocked_source_config.required,
                "default": mocked_source_config.default,
            }
        ]
        mock_service.get_actions.assert_awaited_once_with(source_code_version_id=scv_id, requester=mocked_user)
        mock_service.update_configs_orm.assert_awaited_once()
        await_kwargs = mock_service.update_configs_orm.await_args.kwargs
        assert await_kwargs["source_code_version_id"] == str(scv_id)
        payload = await_kwargs["configs"][0]
        assert str(payload.id) == str(mocked_source_config.id)
        assert payload.template_id is not None
        assert payload.reference_template_id is not None
        assert payload.output_config_name == "output_one"

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_update_source_code_version_configs_denies_without_edit_action(
        self,
        mock_get_service,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[])
        mock_service.update_configs_orm = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            UPDATE_SOURCE_CODE_VERSION_CONFIGS_MUTATION,
            variable_values={
                "id": str(scv_id),
                "configs": [
                    {
                        "id": str(uuid4()),
                        "required": True,
                        "templateId": str(uuid4()),
                    }
                ],
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateSourceCodeVersionConfigs"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_service.update_configs_orm.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_update_source_code_version_configs_empty_returns_empty_list(
        self,
        mock_get_service,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_service.update_configs_orm = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            UPDATE_SOURCE_CODE_VERSION_CONFIGS_MUTATION,
            variable_values={
                "id": str(scv_id),
                "configs": [],
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"updateSourceCodeVersionConfigs": []}
        mock_service.update_configs_orm.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_source_code_version_action_raises_on_invalid_action(
        self,
        mock_get_service,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock()
        mock_service.patch_action = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            SOURCE_CODE_VERSION_ACTION_MUTATION,
            variable_values={
                "id": str(scv_id),
                "input": {
                    "action": "unknown",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["sourceCodeVersionAction"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_service.get_actions.assert_not_awaited()
        mock_service.patch_action.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_source_code_version_action_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[])
        mock_service.patch_action = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            SOURCE_CODE_VERSION_ACTION_MUTATION,
            variable_values={
                "id": str(scv_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["sourceCodeVersionAction"] is None
        assert result.errors is not None
        assert any("Access denied for action disable" in error.message for error in result.errors)
        mock_service.get_actions.assert_awaited_once_with(source_code_version_id=scv_id, requester=mocked_user)
        mock_service.patch_action.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_source_code_version_action_returns_updated(
        self,
        mock_get_service,
        source_code_version,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[ModelActions.DISABLE.value])
        mock_service.patch_action = AsyncMock(return_value=source_code_version)
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            SOURCE_CODE_VERSION_ACTION_MUTATION,
            variable_values={
                "id": str(scv_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["sourceCodeVersionAction"] == {
            "id": str(source_code_version.id),
            "sourceCodeFolder": source_code_version.source_code_folder,
            "sourceCodeVersion": source_code_version.source_code_version,
        }
        mock_service.get_actions.assert_awaited_once_with(source_code_version_id=scv_id, requester=mocked_user)
        mock_service.patch_action.assert_awaited_once()
        assert mock_service.patch_action.await_args
        call_kwargs = mock_service.patch_action.await_args.kwargs
        assert call_kwargs["source_code_version_id"] == str(scv_id)
        assert call_kwargs["requester"] == mocked_user
        assert call_kwargs["body"].action == ModelActions.DISABLE.value

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_delete_source_code_version_denies_without_delete_action(
        self,
        mock_get_service,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[])
        mock_service.delete = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            DELETE_SOURCE_CODE_VERSION_MUTATION,
            variable_values={"id": str(scv_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteSourceCodeVersion"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_service.get_actions.assert_awaited_once_with(source_code_version_id=scv_id, requester=mocked_user)
        mock_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.mutations.get_source_code_version_service")
    async def test_delete_source_code_version_returns_true(
        self,
        mock_get_service,
        mocked_user,
    ):
        scv_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        mock_service.delete = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            DELETE_SOURCE_CODE_VERSION_MUTATION,
            variable_values={"id": str(scv_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteSourceCodeVersion": True}
        mock_service.get_actions.assert_awaited_once_with(source_code_version_id=scv_id, requester=mocked_user)
        mock_service.delete.assert_awaited_once_with(source_code_version_id=str(scv_id), requester=mocked_user)
