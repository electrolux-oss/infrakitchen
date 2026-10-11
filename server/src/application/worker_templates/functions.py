from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_api_permission
from core.users.model import UserDTO


async def get_worker_template_actions(requester: UserDTO, status: ModelStatus) -> list[str]:
    """Get all actions available for a worker template based on user permissions and its status."""
    apis = await user_api_permission(requester, "worker_template")
    if not apis:
        return []
    requester_permissions = [apis["api:worker_template"]]

    if "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status == ModelStatus.ENABLED:
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DISABLE)
    if status == ModelStatus.DISABLED:
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DELETE)
        actions.append(ModelActions.ENABLE)

    return actions
