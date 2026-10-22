from typing import Any, cast
from datetime import datetime, UTC
from kubernetes_asyncio.client import Configuration, CoreV1Api, ApiClient, AppsV1Api, V1Pod


class KubernetesClient:
    def __init__(self, configuration: Configuration):
        self.configuration: Configuration = configuration

    async def list_namespaces(self, raw: bool = False):
        async with ApiClient(self.configuration) as api:
            v1 = CoreV1Api(api)
            namespaces = await v1.list_namespace()
        if raw:
            return namespaces
        return [n.metadata.name for n in namespaces.items]

    async def list_namespaced_pods(self, namespace: str, raw: bool = False):
        async with ApiClient(self.configuration) as api:
            v1 = CoreV1Api(api)
            pods = await v1.list_namespaced_pod(namespace)

            if raw:
                return pods

            return [n.metadata.name for n in pods.items]

    async def list_namespaced_services(self, namespace: str, raw: bool = False):
        async with ApiClient(self.configuration) as api:
            v1 = CoreV1Api(api)
            services = await v1.list_namespaced_service(namespace)
        if raw:
            return services

        return [n.metadata.name for n in services.items]

    async def list_namespaced_deployment(self, namespace: str, raw: bool = False):
        async with ApiClient(self.configuration) as api:
            apps_v1 = AppsV1Api(api)
            deployments = await apps_v1.list_namespaced_deployment(namespace)
        if raw:
            return deployments

        return [n.metadata.name for n in deployments.items]

    async def list_deployment_pods(self, deployment_name: str, namespace: str, raw: bool = False):
        async with ApiClient(self.configuration) as api:
            apps_v1 = AppsV1Api(api)
            deployment = await apps_v1.read_namespaced_deployment(name=deployment_name, namespace=namespace)
            if not deployment:
                raise ValueError(f"Deployment {deployment_name} not found in namespace {namespace}")

            match_labels = deployment.spec.selector.match_labels if deployment.spec.selector else None
            if not match_labels:
                return []

            label_selector = ",".join([f"{k}={v}" for k, v in match_labels.items()])

            v1 = CoreV1Api(api)
            pods = await v1.list_namespaced_pod(namespace, label_selector=label_selector)

            if raw:
                return [pod.to_dict() for pod in pods.items]

            return [n.metadata.name for n in pods.items]

    async def read_namespaced_deployment(self, deployment_name: str, namespace: str):
        async with ApiClient(self.configuration) as api:
            apps_v1 = AppsV1Api(api)
            return await apps_v1.read_namespaced_deployment(name=deployment_name, namespace=namespace)

    async def patch_namespaced_deployment(self, deployment: str, namespace: str, body: dict[str, Any]):
        async with ApiClient(self.configuration) as api:
            apps_v1 = AppsV1Api(api)
            return await apps_v1.patch_namespaced_deployment(deployment, namespace, body)

    async def delete_namespaced_deployment(self, deployment: str, namespace: str):
        async with ApiClient(self.configuration) as api:
            apps_v1 = AppsV1Api(api)
            return await apps_v1.delete_namespaced_deployment(deployment, namespace)

    async def delete_namespaced_pod(self, pod_name: str, namespace: str):
        async with ApiClient(self.configuration) as api:
            v1 = CoreV1Api(api)
            return await v1.delete_namespaced_pod(pod_name, namespace)

    async def read_namespaced_pod(self, pod_name: str, namespace: str) -> dict[str, Any]:
        """The pod as a manifest-style dict (camelCase keys), as it would be written in YAML."""
        async with ApiClient(self.configuration) as api:
            v1 = CoreV1Api(api)
            pod = await v1.read_namespaced_pod(pod_name, namespace)
            return api.sanitize_for_serialization(pod)

    async def read_namespaced_pod_log(self, pod_name: str, namespace: str, tail_lines: int = 500) -> str:
        async with ApiClient(self.configuration) as api:
            v1 = CoreV1Api(api)
            return await v1.read_namespaced_pod_log(pod_name, namespace, tail_lines=tail_lines, timestamps=True)

    async def list_labeled_pods(self, namespace: str, label_selector: str) -> list[V1Pod]:
        async with ApiClient(self.configuration) as api:
            v1 = CoreV1Api(api)
            pods = await v1.list_namespaced_pod(namespace, label_selector=label_selector)
        return list(pods.items)

    async def create_namespaced_pod(self, namespace: str, body: dict[str, Any], dry_run: bool = False) -> V1Pod:
        # The API client serializes plain dicts as-is, so a manifest can be sent without building a V1Pod
        pod = cast(V1Pod, cast(object, body))
        async with ApiClient(self.configuration) as api:
            v1 = CoreV1Api(api)
            if dry_run:
                return await v1.create_namespaced_pod(namespace, pod, dry_run="All")
            return await v1.create_namespaced_pod(namespace, pod)

    async def restart_namespaced_deployment(self, deployment: str, namespace: str):
        async with ApiClient(self.configuration) as api:
            apps_v1 = AppsV1Api(api)

            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {"kubectl.kubernetes.io/restartedAt": datetime.now(UTC).isoformat()}
                        }
                    }
                }
            }

            return await apps_v1.patch_namespaced_deployment(name=deployment, namespace=namespace, body=body)
