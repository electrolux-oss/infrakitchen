from uuid import UUID

from core.constants.model import ModelActions, ModelState, ModelStatus
from core.permissions.service import PermissionService
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO


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
