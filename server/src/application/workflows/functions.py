from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_api_permission
from core.users.model import UserDTO


async def get_workflow_actions(requester: UserDTO, status: str) -> list[str]:
    apis = await user_api_permission(requester, "workflow")
    if not apis:
        return []
    requester_permissions = [apis.get("api:workflow", "")]

    actions: list[str] = []

    if "write" in requester_permissions or "admin" in requester_permissions:
        actions.append(ModelActions.EXECUTE)

    if status in (ModelStatus.PENDING, ModelStatus.ERROR):
        if "write" in requester_permissions or "admin" in requester_permissions:
            actions.append(ModelActions.EDIT)

    if "admin" in requester_permissions:
        actions.append(ModelActions.DELETE)

    return actions
