from ..model import WorkerTemplateDTO
from .base import WorkerInstance, WorkerInstancePhase, WorkerProvider
from .kubernetes import KubernetesWorkerProvider

# Register new worker providers here
WORKER_PROVIDERS: dict[str, type[WorkerProvider]] = {
    KubernetesWorkerProvider.provider: KubernetesWorkerProvider,
}


def get_worker_provider_class(provider: str) -> type[WorkerProvider]:
    provider_class = WORKER_PROVIDERS.get(provider)
    if provider_class is None:
        raise ValueError(f"Unknown worker provider: {provider}")
    return provider_class


def get_worker_provider(template: WorkerTemplateDTO) -> WorkerProvider:
    return get_worker_provider_class(template.provider)(template)


__all__ = [
    "WORKER_PROVIDERS",
    "WorkerInstance",
    "WorkerInstancePhase",
    "WorkerProvider",
    "get_worker_provider",
    "get_worker_provider_class",
]
