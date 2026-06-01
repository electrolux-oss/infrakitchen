from core.constants.model import ModelActions
from core.users.functions import user_api_permission
from core.users.model import UserDTO


async def get_batch_operation_actions(
    requester: UserDTO,
) -> list[str]:
    """Get all actions available for a batch operation based on user permissions."""
    apis = await user_api_permission(requester, "batch_operation")
    if not apis:
        return []
    requester_permissions = [apis["api:batch_operation"]]

    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    if "admin" not in requester_permissions:
        return []

    actions: list[str] = []
    actions.append(ModelActions.DELETE)
    # For simplicity, we allow both "add" and "remove" actions for entity_ids patching
    # if the user has admin permissions.
    actions.append("remove")
    actions.append("add")

    return actions
