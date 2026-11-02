"""Helpers shared by the worker providers; the provider interface is ``core.adapters.WorkerProviderAdapter``."""

import re

from core.adapters.provider_adapters import WorkerTemplateSpec

# Names of spawned workers start with this, followed by the template slug
WORKER_NAME_PREFIX = "ik-worker-"

MANAGED_BY_LABEL = "app.kubernetes.io/managed-by"
MANAGED_BY_VALUE = "infrakitchen"
TEMPLATE_LABEL = "infrakitchen.io/worker-template"


def instance_labels(template: WorkerTemplateSpec) -> dict[str, str]:
    return {MANAGED_BY_LABEL: MANAGED_BY_VALUE, TEMPLATE_LABEL: str(template.id)}


def template_slug(template_name: str, max_length: int = 40) -> str:
    """Template name reduced to what pod and container names allow."""
    return re.sub(r"[^a-z0-9-]+", "-", template_name.lower()).strip("-")[:max_length].rstrip("-")


def worker_name_prefix(template_name: str) -> str:
    slug = template_slug(template_name)
    return f"{WORKER_NAME_PREFIX}{slug}-" if slug else WORKER_NAME_PREFIX


# Environment variables never copied from the InfraKitchen process to spawned workers:
# set per worker by the autoscaler, or only meaningful for the process that has them
NOT_INHERITED_ENV = {
    "HOSTNAME",
    "HOME",
    "PATH",
    "WORKER_IDLE_EXIT_SECONDS",
    "WORKER_TEMPLATE_ID",
    "WORKER_NAME",
    "WORKER_HOST",
}

# Workers register with this host, which must be the instance id so the autoscaler can match them
# (the hostname is not reliable: host networking gives the worker the node's one)
WORKER_HOST_ENV = "WORKER_HOST"
NOT_INHERITED_ENV_PREFIXES = ("WORKER_AUTOSCALER_",)


SENSITIVE_ENV_PARTS = ("KEY", "SECRET", "PASSWORD", "PASSWD", "TOKEN", "CREDENTIAL", "PRIVATE", "DSN", "URL", "URI")
MASKED = "********"


def mask_env(env: list[str]) -> list[str]:
    """``KEY=value`` entries with the value hidden for names that look like secrets."""
    masked: list[str] = []
    for item in env:
        name, separator, _ = item.partition("=")
        masked.append(f"{name}={MASKED}" if separator and any(p in name.upper() for p in SENSITIVE_ENV_PARTS) else item)
    return masked


def is_inherited_env(name: str) -> bool:
    return name not in NOT_INHERITED_ENV and not name.startswith(NOT_INHERITED_ENV_PREFIXES)
