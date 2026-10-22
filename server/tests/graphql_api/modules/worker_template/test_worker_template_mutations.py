from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch

from application.providers.worker_providers.kubernetes_default_manifest import DEFAULT_POD_MANIFEST
from core.adapters.provider_adapters import WorkerInstance
from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_MUTATION = """
    mutation CreateWorkerTemplate($input: WorkerTemplateCreateInput!) {
        createWorkerTemplate(input: $input) {
            id
            name
            provider
            maxWorkers
            entityName
        }
    }
"""

DELETE_MUTATION = """
    mutation DeleteWorkerTemplate($id: UUID!) {
        deleteWorkerTemplate(id: $id)
    }
"""

SET_DEFAULT_MUTATION = """
    mutation SetDefault($id: UUID) {
        setDefaultWorkerTemplate(id: $id) { id isDefault }
    }
"""

OPTIONS_QUERY = """
    query { workerTemplateOptions { id name status isDefault entityName } }
"""

DEFAULT_CONFIGURATION_QUERY = """
    query { workerProviders workerTemplateDefaultConfiguration(provider: "kubernetes") }
"""

INSTANCES_QUERY = """
    query Instances($id: UUID!) {
        workerTemplateInstances(id: $id) {
            instances { id host phase }
            error
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestWorkerTemplateMutations:
    @patch("graphql_api.modules.worker_template.mutations.get_worker_template_service")
    async def test_create(self, mock_get_service, mock_worker_template_service, mocked_worker_template, mocked_user):
        mock_worker_template_service.create_worker_template = AsyncMock(return_value=mocked_worker_template)
        mock_get_service.return_value = mock_worker_template_service

        result = await schema.execute(
            CREATE_MUTATION,
            variable_values={
                "input": {
                    "name": "default",
                    "provider": "kubernetes",
                    "maxWorkers": 3,
                    "configuration": {"provider": "kubernetes", "pod_manifest": DEFAULT_POD_MANIFEST},
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createWorkerTemplate"] == {
            "id": str(mocked_worker_template.id),
            "name": "default",
            "provider": "kubernetes",
            "maxWorkers": 3,
            "entityName": "worker_template",
        }
        mock_worker_template_service.create_worker_template.assert_awaited_once_with(
            worker_template=ANY, requester=mocked_user
        )

    @patch("graphql_api.modules.worker_template.mutations.get_worker_template_service")
    async def test_create_rejects_invalid_manifest(self, mock_get_service, mock_worker_template_service, mocked_user):
        mock_worker_template_service.create_worker_template = AsyncMock()
        mock_get_service.return_value = mock_worker_template_service

        result = await schema.execute(
            CREATE_MUTATION,
            variable_values={
                "input": {
                    "name": "default",
                    "provider": "kubernetes",
                    "configuration": {"provider": "kubernetes", "pod_manifest": "kind: Deployment"},
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is not None
        mock_worker_template_service.create_worker_template.assert_not_awaited()

    @patch("graphql_api.modules.worker_template.mutations.get_worker_template_service")
    async def test_set_default(
        self, mock_get_service, mock_worker_template_service, mocked_worker_template, mocked_user
    ):
        mocked_worker_template.is_default = True
        mock_worker_template_service.set_default = AsyncMock(return_value=mocked_worker_template)
        mock_get_service.return_value = mock_worker_template_service

        result = await schema.execute(
            SET_DEFAULT_MUTATION,
            variable_values={"id": str(mocked_worker_template.id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"setDefaultWorkerTemplate": {"id": str(mocked_worker_template.id), "isDefault": True}}
        mock_worker_template_service.set_default.assert_awaited_once_with(
            mocked_worker_template.id, requester=mocked_user
        )

    @patch("graphql_api.modules.worker_template.mutations.get_worker_template_service")
    async def test_clear_default(self, mock_get_service, mock_worker_template_service, mocked_user):
        mock_worker_template_service.set_default = AsyncMock(return_value=None)
        mock_get_service.return_value = mock_worker_template_service

        result = await schema.execute(SET_DEFAULT_MUTATION, context_value=make_context(mocked_user))

        assert result.errors is None
        assert result.data == {"setDefaultWorkerTemplate": None}
        mock_worker_template_service.set_default.assert_awaited_once_with(None, requester=mocked_user)

    @patch("graphql_api.modules.worker_template.queries.get_worker_template_service")
    async def test_options_expose_no_configuration(
        self, mock_get_service, mock_worker_template_service, mocked_worker_template, mocked_user
    ):
        mocked_worker_template.is_default = True
        mock_worker_template_service.query_all = AsyncMock(return_value=[mocked_worker_template])
        mock_get_service.return_value = mock_worker_template_service

        result = await schema.execute(OPTIONS_QUERY, context_value=make_context(mocked_user))

        assert result.errors is None
        assert result.data == {
            "workerTemplateOptions": [
                {
                    "id": str(mocked_worker_template.id),
                    "name": "default",
                    "status": "enabled",
                    "isDefault": True,
                    "entityName": "worker_template",
                }
            ]
        }

    @patch("graphql_api.modules.worker_template.mutations.get_worker_template_service")
    async def test_delete_requires_action(
        self, mock_get_service, mock_worker_template_service, mocked_worker_template, mocked_user
    ):
        mock_worker_template_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_worker_template_service.delete = AsyncMock()
        mock_get_service.return_value = mock_worker_template_service

        result = await schema.execute(
            DELETE_MUTATION,
            variable_values={"id": str(mocked_worker_template.id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is not None
        mock_worker_template_service.delete.assert_not_awaited()


class TestWorkerTemplateQueries:
    async def test_default_configuration(self, mocked_user):
        result = await schema.execute(DEFAULT_CONFIGURATION_QUERY, context_value=make_context(mocked_user))

        assert result.errors is None
        assert result.data is not None
        assert result.data["workerProviders"] == ["kubernetes"]
        assert result.data["workerTemplateDefaultConfiguration"]["pod_manifest"] == DEFAULT_POD_MANIFEST

    @patch("graphql_api.modules.worker_template.queries.get_worker_template_service")
    async def test_instances(self, mock_get_service, mock_worker_template_service, mocked_worker_template, mocked_user):
        mock_worker_template_service.list_instances = AsyncMock(
            return_value=[WorkerInstance(id="ik-worker-a", host="ik-worker-a", phase="running")]
        )
        mock_get_service.return_value = mock_worker_template_service

        result = await schema.execute(
            INSTANCES_QUERY,
            variable_values={"id": str(mocked_worker_template.id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["workerTemplateInstances"] == {
            "instances": [{"id": "ik-worker-a", "host": "ik-worker-a", "phase": "running"}],
            "error": None,
        }

    @patch("graphql_api.modules.worker_template.queries.get_worker_template_service")
    async def test_instances_reports_provider_error(
        self, mock_get_service, mock_worker_template_service, mocked_worker_template, mocked_user
    ):
        mock_worker_template_service.list_instances = AsyncMock(side_effect=RuntimeError("not in cluster"))
        mock_get_service.return_value = mock_worker_template_service

        result = await schema.execute(
            INSTANCES_QUERY,
            variable_values={"id": str(mocked_worker_template.id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["workerTemplateInstances"] == {"instances": [], "error": "not in cluster"}
