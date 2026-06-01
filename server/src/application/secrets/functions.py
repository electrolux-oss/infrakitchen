from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_api_permission
from core.users.model import UserDTO


async def get_secret_actions(requester: UserDTO, status: ModelStatus) -> list[str]:
    """Get all actions available for a secret based on user permissions and secret status."""
    apis = await user_api_permission(requester, "secret")
    if not apis:
        return []
    requester_permissions = [apis["api:secret"]]

    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status == ModelStatus.ENABLED:
        if "admin" in requester_permissions:
            actions.append(ModelActions.EDIT)
            actions.append(ModelActions.DISABLE)
    if status == ModelStatus.DISABLED:
        if "admin" in requester_permissions:
            actions.append(ModelActions.DELETE)
            actions.append(ModelActions.ENABLE)

    return actions
