from uuid import UUID

from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO


async def get_integration_actions(requester: UserDTO, integration_id: str | UUID, status: ModelStatus) -> list[str]:
    """Get all actions available for an integration based on user permissions and integration status."""
    requester_permissions = await user_entity_permissions(requester, integration_id, "integration")
    if "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status == ModelStatus.ENABLED:
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DISABLE)
    if status == ModelStatus.DISABLED:
        actions.append(ModelActions.ENABLE)
        actions.append(ModelActions.DELETE)

    return actions
