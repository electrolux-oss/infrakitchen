from contextlib import AbstractAsyncContextManager
from typing import Any

import yaml

from core.constants.model import ModelActions, ModelStatus
from core.db_engine import try_advisory_lock
from core.users.functions import user_api_permission
from core.users.model import UserDTO


SET_DEFAULT = "set_default"
CLEAR_DEFAULT = "clear_default"

# Serializes changes of the default template, and enqueues against them (see routing.resolve_worker_templates)
DEFAULT_LOCK_KEY = 0x494B5744  # "IKWD"

# Only one scheduler process reconciles workers at a time
AUTOSCALER_LOCK_KEY = 0x494B5753  # "IKWS"


def autoscaler_lock() -> AbstractAsyncContextManager[bool]:
    """Held for a whole autoscaling pass, and while a template's workers are cleaned up before deletion."""
    return try_advisory_lock(AUTOSCALER_LOCK_KEY)


async def get_worker_template_actions(requester: UserDTO, status: ModelStatus, is_default: bool = False) -> list[str]:
    """Get all actions available for a worker template based on user permissions and its status."""
    apis = await user_api_permission(requester, "worker_template")
    if not apis:
        return []
    requester_permissions = [apis["api:worker_template"]]

    if "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if is_default:
        # the default can't be disabled, clear it or select another default first
        return [ModelActions.EDIT, CLEAR_DEFAULT]

    if status == ModelStatus.ENABLED:
        actions.append(ModelActions.EDIT)
        actions.append(SET_DEFAULT)
        actions.append(ModelActions.DISABLE)
    if status == ModelStatus.DISABLED:
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DELETE)
        actions.append(ModelActions.ENABLE)

    return actions


async def can_select_worker_template(requester: UserDTO) -> bool:
    """Whether the requester may choose the worker template of a resource or an executor."""
    apis = await user_api_permission(requester, "worker_template")
    return bool(apis and apis.get("api:worker_template"))


def parse_pod_manifest(manifest: str) -> dict[str, Any]:
    try:
        pod = yaml.safe_load(manifest)
    except yaml.YAMLError as e:
        raise ValueError(f"Pod manifest is not valid YAML: {e}") from e

    if not isinstance(pod, dict):
        raise ValueError("Pod manifest must be a YAML mapping")
    if pod.get("kind") != "Pod":
        raise ValueError("Pod manifest must have 'kind: Pod'")
    spec = pod.get("spec")
    if not isinstance(spec, dict) or not isinstance(spec.get("containers"), list) or not spec["containers"]:
        raise ValueError("Pod manifest must define at least one container in 'spec.containers'")
    return pod
