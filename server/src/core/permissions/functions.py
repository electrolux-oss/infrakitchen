from core.constants.model import ModelActions
from core.users.functions import user_api_permission
from core.users.model import UserDTO


async def get_permission_actions(requester: UserDTO) -> list[str]:
    apis = await user_api_permission(requester, "permission")
    if not apis:
        return []
    requester_permissions = [apis["api:permission"]]

    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    return [ModelActions.EDIT, ModelActions.DELETE]
