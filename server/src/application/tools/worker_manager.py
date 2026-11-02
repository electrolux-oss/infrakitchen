from typing import Any

from ..providers import WorkerProviderAdapter
from ..worker_templates.model import WorkerTemplateDTO


def get_worker_provider_class(provider: str) -> type[WorkerProviderAdapter]:
    provider_class = WorkerProviderAdapter.adapters.get(provider)
    if provider_class is None:
        raise ValueError(f"Unknown worker provider: {provider}")
    return provider_class


def get_worker_provider(template: WorkerTemplateDTO) -> WorkerProviderAdapter:
    """The provider that spawns, lists and deletes the workers of ``template``."""
    return get_worker_provider_class(template.provider)(template)


def list_worker_providers() -> list[str]:
    return list(WorkerProviderAdapter.adapters.keys())


def get_default_worker_configuration(provider: str) -> dict[str, Any]:
    return get_worker_provider_class(provider).default_configuration()
