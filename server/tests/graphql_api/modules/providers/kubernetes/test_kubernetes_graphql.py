from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from graphql_api.schema import schema


# ── Query strings ──────────────────────────────────────────────────────────

KUBERNETES_NAMESPACES_QUERY = """
    query KubernetesNamespaces($k8sService: String!, $resourceId: String!) {
        kubernetesNamespaces(k8sService: $k8sService, resourceId: $resourceId)
    }
"""

KUBERNETES_DEPLOYMENTS_QUERY = """
    query KubernetesDeployments($k8sService: String!, $resourceId: String!, $namespace: String!) {
        kubernetesDeployments(k8sService: $k8sService, resourceId: $resourceId, namespace: $namespace)
    }
"""

KUBERNETES_PODS_QUERY = """
    query KubernetesPods($k8sService: String!, $resourceId: String!, $namespace: String!) {
        kubernetesPods(k8sService: $k8sService, resourceId: $resourceId, namespace: $namespace)
    }
"""

KUBERNETES_SERVICES_QUERY = """
    query KubernetesServices($k8sService: String!, $resourceId: String!, $namespace: String!) {
        kubernetesServices(k8sService: $k8sService, resourceId: $resourceId, namespace: $namespace)
    }
"""

KUBERNETES_DEPLOYMENT_PODS_QUERY = """
    query KubernetesDeploymentPods(
        $k8sService: String!, $resourceId: String!, $namespace: String!, $deploymentName: String!
    ) {
        kubernetesDeploymentPods(
            k8sService: $k8sService, resourceId: $resourceId,
            namespace: $namespace, deploymentName: $deploymentName
        )
    }
"""

DELETE_KUBERNETES_POD_MUTATION = """
    mutation DeleteKubernetesPod(
        $k8sService: String!, $resourceId: String!, $namespace: String!, $podName: String!
    ) {
        deleteKubernetesPod(
            k8sService: $k8sService, resourceId: $resourceId,
            namespace: $namespace, podName: $podName
        )
    }
"""

RESTART_KUBERNETES_DEPLOYMENT_MUTATION = """
    mutation RestartKubernetesDeployment(
        $k8sService: String!, $resourceId: String!, $namespace: String!, $deploymentName: String!
    ) {
        restartKubernetesDeployment(
            k8sService: $k8sService, resourceId: $resourceId,
            namespace: $namespace, deploymentName: $deploymentName
        )
    }
"""


# ── Helpers ────────────────────────────────────────────────────────────────


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


COMMON_VARS = {"k8sService": "aws_eks", "resourceId": "res-123"}


# ── Fixtures ───────────────────────────────────────────────────────────────

SAMPLE_POD = {
    "metadata": {
        "name": "web-abc123",
        "uid": "uid-1",
        "labels": {"app": "web", "app.kubernetes.io/version": "1.0.0"},
        "annotations": {"note": "test"},
        "creation_timestamp": "2024-06-01T00:00:00Z",
    },
    "status": {"phase": "Running"},
    "spec": {"containers": [{"name": "app", "image": "nginx:latest"}]},
}


# ── Tests ──────────────────────────────────────────────────────────────────


class TestKubernetesGraphqlQueries:
    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.providers.kubernetes.queries.user_has_access_to_entity",
        new_callable=AsyncMock,
        return_value=True,
    )
    @patch("graphql_api.modules.providers.kubernetes.queries.build_kubernetes_client")
    async def test_kubernetes_namespaces(self, mock_build, _mock_access, mocked_user):
        mock_build.return_value = Mock(list_namespaces=AsyncMock(return_value=["default", "kube-system"]))

        result = await schema.execute(
            KUBERNETES_NAMESPACES_QUERY,
            variable_values=COMMON_VARS,
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"kubernetesNamespaces": ["default", "kube-system"]}

    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.providers.kubernetes.queries.user_has_access_to_entity",
        new_callable=AsyncMock,
        return_value=True,
    )
    @patch("graphql_api.modules.providers.kubernetes.queries.build_kubernetes_client")
    async def test_kubernetes_deployments(self, mock_build, _mock_access, mocked_user):
        mock_build.return_value = Mock(list_namespaced_deployment=AsyncMock(return_value=["web", "api"]))

        result = await schema.execute(
            KUBERNETES_DEPLOYMENTS_QUERY,
            variable_values={**COMMON_VARS, "namespace": "default"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"kubernetesDeployments": ["web", "api"]}

    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.providers.kubernetes.queries.user_has_access_to_entity",
        new_callable=AsyncMock,
        return_value=True,
    )
    @patch("graphql_api.modules.providers.kubernetes.queries.build_kubernetes_client")
    async def test_kubernetes_pods(self, mock_build, _mock_access, mocked_user):
        mock_build.return_value = Mock(list_namespaced_pods=AsyncMock(return_value=["pod-1", "pod-2"]))

        result = await schema.execute(
            KUBERNETES_PODS_QUERY,
            variable_values={**COMMON_VARS, "namespace": "default"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"kubernetesPods": ["pod-1", "pod-2"]}

    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.providers.kubernetes.queries.user_has_access_to_entity",
        new_callable=AsyncMock,
        return_value=True,
    )
    @patch("graphql_api.modules.providers.kubernetes.queries.build_kubernetes_client")
    async def test_kubernetes_services(self, mock_build, _mock_access, mocked_user):
        mock_build.return_value = Mock(list_namespaced_services=AsyncMock(return_value=["svc-web", "svc-api"]))

        result = await schema.execute(
            KUBERNETES_SERVICES_QUERY,
            variable_values={**COMMON_VARS, "namespace": "default"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"kubernetesServices": ["svc-web", "svc-api"]}

    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.providers.kubernetes.queries.user_has_access_to_entity",
        new_callable=AsyncMock,
        return_value=True,
    )
    @patch("graphql_api.modules.providers.kubernetes.queries.build_kubernetes_client")
    async def test_kubernetes_deployment_pods(self, mock_build, _mock_access, mocked_user):
        mock_build.return_value = Mock(list_deployment_pods=AsyncMock(return_value=[SAMPLE_POD]))

        result = await schema.execute(
            KUBERNETES_DEPLOYMENT_PODS_QUERY,
            variable_values={**COMMON_VARS, "namespace": "default", "deploymentName": "web"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"kubernetesDeploymentPods": [SAMPLE_POD]}


class TestKubernetesGraphqlMutations:
    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.providers.kubernetes.mutations.user_has_access_to_entity",
        new_callable=AsyncMock,
        return_value=True,
    )
    @patch("graphql_api.modules.providers.kubernetes.mutations.build_kubernetes_client")
    async def test_delete_kubernetes_pod(self, mock_build, _mock_access, mocked_user):
        mock_client = Mock(delete_namespaced_pod=AsyncMock())
        mock_build.return_value = mock_client

        result = await schema.execute(
            DELETE_KUBERNETES_POD_MUTATION,
            variable_values={**COMMON_VARS, "namespace": "default", "podName": "web-abc123"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "deleteKubernetesPod": {"message": "Pod 'web-abc123' in namespace 'default' deleted successfully."}
        }
        mock_client.delete_namespaced_pod.assert_awaited_once_with(pod_name="web-abc123", namespace="default")

    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.providers.kubernetes.mutations.user_has_access_to_entity",
        new_callable=AsyncMock,
        return_value=True,
    )
    @patch("graphql_api.modules.providers.kubernetes.mutations.build_kubernetes_client")
    async def test_restart_kubernetes_deployment(self, mock_build, _mock_access, mocked_user):
        mock_client = Mock(restart_namespaced_deployment=AsyncMock())
        mock_build.return_value = mock_client

        result = await schema.execute(
            RESTART_KUBERNETES_DEPLOYMENT_MUTATION,
            variable_values={**COMMON_VARS, "namespace": "default", "deploymentName": "web"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "restartKubernetesDeployment": {
                "message": "Deployment 'web' in namespace 'default' restarted successfully."
            }
        }
        mock_client.restart_namespaced_deployment.assert_awaited_once_with(deployment="web", namespace="default")


class TestKubernetesGraphqlAuth:
    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.providers.kubernetes.queries.user_has_access_to_entity",
        new_callable=AsyncMock,
        return_value=False,
    )
    @patch("graphql_api.modules.providers.kubernetes.queries.build_kubernetes_client")
    async def test_kubernetes_namespaces_denied(self, mock_build, _mock_access, mocked_user):
        result = await schema.execute(
            KUBERNETES_NAMESPACES_QUERY,
            variable_values=COMMON_VARS,
            context_value=make_context(mocked_user),
        )

        assert result.errors is not None
        assert "Write access" in str(result.errors[0])
        mock_build.assert_not_called()

    @pytest.mark.asyncio
    async def test_kubernetes_namespaces_unauthenticated(self):
        result = await schema.execute(
            KUBERNETES_NAMESPACES_QUERY,
            variable_values=COMMON_VARS,
            context_value=make_context(None),
        )

        assert result.errors is not None
