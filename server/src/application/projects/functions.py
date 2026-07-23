from uuid import UUID
from application.projects.model import Project
from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_api_permission, user_entity_permissions
from core.users.functions import user_is_super_admin
from core.users.model import UserDTO


def _requester_id(requester: UserDTO) -> str:
    if requester.primary_account:
        return str(requester.primary_account[0].id)
    return str(requester.id)


def _get_owner_ids(project: Project) -> list[str]:
    return [str(owner.id) for owner in project.owners]


async def get_project_actions(
    requester: UserDTO,
    project_id: str | UUID,
    status: ModelStatus,
    project: Project | None = None,
) -> list[str]:
    """Get all actions available for a project based on user permissions and project status."""
    if await user_is_super_admin(requester):
        is_project_admin = True
    else:
        is_project_admin = False

    requester_permissions = await user_entity_permissions(requester, project_id, "project")

    if "admin" in requester_permissions:
        is_project_admin = True

    apis = await user_api_permission(requester, "project")
    requester_permissions = [apis["api:project"]] if apis else []

    if "admin" in requester_permissions:
        is_project_admin = True

    if await requester_is_project_owner(requester, project):
        is_project_admin = True

    if not is_project_admin:
        return []

    actions: list[str] = []

    if status == ModelStatus.ENABLED:
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DISABLE)
    if status == ModelStatus.DISABLED:
        actions.append(ModelActions.DELETE)
        actions.append(ModelActions.ENABLE)

    return actions


async def requester_is_project_owner(requester: UserDTO, project: Project | None) -> bool:
    """Check if the requester is a project owner."""
    if project is None:
        return False
    owner_ids = _get_owner_ids(project)
    if not owner_ids:
        return False
    return _requester_id(requester) in owner_ids
