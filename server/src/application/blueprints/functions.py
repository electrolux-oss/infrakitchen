from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_api_permission
from core.users.model import UserDTO


async def get_blueprint_actions(requester: UserDTO, status: ModelStatus | str) -> list[str]:
    """Get all actions available for a blueprint based on user permissions and blueprint status."""
    apis = await user_api_permission(requester, "blueprint")
    if not apis:
        return []
    requester_permissions = [apis["api:blueprint"]]

    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    if "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status == ModelStatus.ENABLED:
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DISABLE)
    if status == ModelStatus.DISABLED:
        actions.append(ModelActions.DELETE)
        actions.append(ModelActions.ENABLE)

    return actions
