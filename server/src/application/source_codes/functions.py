from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_api_permission
from core.users.model import UserDTO


async def get_source_code_actions(requester: UserDTO, status: ModelStatus) -> list[str]:
    """Get all actions available for a source code based on user permissions and source code status."""
    apis = await user_api_permission(requester, "source_code")
    if not apis:
        return []
    requester_permissions = [apis["api:source_code"]]

    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    if "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status == ModelStatus.IN_PROGRESS:
        return []

    if status in [ModelStatus.READY, ModelStatus.ERROR, ModelStatus.DONE]:
        actions.append(ModelActions.SYNC)
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DISABLE)
        return actions

    if status == ModelStatus.DISABLED:
        actions.append(ModelActions.ENABLE)
        actions.append(ModelActions.DELETE)
        return actions

    return actions
