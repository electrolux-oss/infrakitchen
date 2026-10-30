from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_api_permission
from core.users.model import UserDTO

ALLOWED_REPOSITORY_TYPES: dict[str, tuple[str, ...]] = {
    "source_code_version": ("module_library",),
    "service": ("application",),
}


def ensure_repository_type(repository_type: str, entity_type: str) -> None:
    allowed = ALLOWED_REPOSITORY_TYPES[entity_type]
    if repository_type not in allowed:
        raise ValueError(
            f"A {entity_type.replace('_', ' ')} requires a {' or '.join(allowed)} repository, "
            f"this one is {repository_type}"
        )


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
