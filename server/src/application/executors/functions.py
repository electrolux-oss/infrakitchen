from typing import TYPE_CHECKING, Any
from uuid import UUID

from core.constants.model import ModelActions, ModelState, ModelStatus
from core.permissions.service import PermissionService
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO

if TYPE_CHECKING:
    from application.executors.model import Executor


def build_executor_audit_snapshot(executor: "Executor") -> dict[str, Any]:
    """Snapshot stored on the delete audit row: the executor and its revisions are gone afterwards."""
    return {
        "id": str(executor.id),
        "name": executor.name,
        "entityName": "executor",
        "status": executor.status,
        "state": executor.state,
        "description": executor.description,
        "runtime": executor.runtime,
        "labels": list(executor.labels or []),
        "createdAt": executor.created_at.isoformat() if executor.created_at else None,
        "updatedAt": executor.updated_at.isoformat() if executor.updated_at else None,
        "revisionNumber": executor.revision_number,
    }


async def delete_executor_policies(
    executor_id: str | UUID,
    permission_service: PermissionService,
) -> None:
    await permission_service.delete_entity_permissions("executor", executor_id)


async def get_executor_actions(
    requester: UserDTO, executor_id: str | UUID, status: ModelStatus, state: ModelState
) -> list[str]:
    """Get all actions available for an executor based on user permissions and executor status/state."""
    requester_permissions = await user_entity_permissions(requester, executor_id, "executor")
    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status in [ModelStatus.IN_PROGRESS]:
        return []

    user_is_admin = "admin" in requester_permissions

    if status == ModelStatus.QUEUED:
        if user_is_admin:
            actions.append(ModelActions.RETRY)
        return actions

    if state == ModelState.PROVISIONED:
        actions.append(ModelActions.DESTROY)
        actions.append(ModelActions.EXECUTE)
        if user_is_admin:
            actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DRYRUN)

    elif state == ModelState.PROVISION:
        actions.append(ModelActions.EXECUTE)
        if user_is_admin:
            actions.append(ModelActions.EDIT)
        if status == ModelStatus.READY:
            actions.append(ModelActions.DRYRUN)
            actions.append(ModelActions.DELETE)
        elif status == ModelStatus.ERROR:
            actions.append(ModelActions.DESTROY)
            actions.append(ModelActions.DRYRUN)
    elif state == ModelState.DESTROYED:
        if status == ModelStatus.DONE:
            actions.append(ModelActions.RECREATE)
            if user_is_admin:
                actions.append(ModelActions.DELETE)
    elif state == ModelState.DESTROY:
        if status == ModelStatus.ERROR or status == ModelStatus.READY:
            actions.append(ModelActions.RECREATE)
            actions.append(ModelActions.EXECUTE)
            actions.append(ModelActions.DRYRUN)

    return actions
