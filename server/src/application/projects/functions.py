from collections.abc import Iterable
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.projects.model import Project, project_owners
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core.users.functions import token_allows, user_api_permission, user_entity_permissions
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
    if project is not None:
        project_permissions = await get_project_permissions(requester, project)
    else:
        project_permissions = set(await user_entity_permissions(requester, project_id, "project"))
    apis = await user_api_permission(requester, "project")

    is_project_admin = (
        await user_is_super_admin(requester)
        or "admin" in project_permissions
        or (apis is not None and apis.get("api:project") == "admin")
    )
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


async def get_project_permissions(requester: UserDTO, project: Project, entity_name: str = "project") -> set[str]:
    """
    The requester's permissions on the project, or inherited from it by an `entity_name` in the project:
    its policies, and admin for the project owners. Clamped to the scopes of the requester's token.
    """
    if await requester_is_project_owner(requester, project):
        permissions = ["admin", "write", "read"]
    else:
        permissions = await user_entity_permissions(requester, project.id, "project")
    return {action for action in permissions if token_allows(action, entity_name)}


async def merge_project_permissions(
    requester: UserDTO, entity_permissions: Iterable[str], project: Project | None, entity_name: str
) -> list[str]:
    """
    Permissions on an entity that belongs to a project (resource, executor): the entity's own permissions
    merged with the project's, the higher level wins. Project owners are entity admins.
    """
    permissions = set(entity_permissions)
    if project is not None and "admin" not in permissions:
        permissions |= await get_project_permissions(requester, project, entity_name)
    return sorted(permissions)


async def owned_project_ids(session: AsyncSession, requester: UserDTO, action: str) -> set[str]:
    """IDs of the projects the requester owns: owners have `action` on them without a policy."""
    if not token_allows(action, "project"):
        return set()
    stmt = select(project_owners.c.project_id).where(project_owners.c.user_id == UUID(_requester_id(requester)))
    return {str(project_id) for project_id in (await session.execute(stmt)).scalars()}


def require_enabled_project(project: Project | None) -> Project:
    """Resources and executors can only be added to an existing, enabled project."""
    if project is None:
        raise EntityNotFound("Project not found")
    if project.status != ModelStatus.ENABLED:
        raise EntityWrongState("Project is not enabled")
    return project
