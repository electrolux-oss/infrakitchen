from collections.abc import Iterable
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.projects.model import Project, project_owners
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
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


async def get_project_permissions(requester: UserDTO, project: Project) -> set[str]:
    """The requester's permissions on the project: its policies, and admin for the project owners."""
    if await requester_is_project_owner(requester, project):
        return {"admin", "write", "read"}
    return set(await user_entity_permissions(requester, project.id, "project"))


async def merge_project_permissions(
    requester: UserDTO, entity_permissions: Iterable[str], project: Project | None
) -> list[str]:
    """
    Permissions on an entity that belongs to a project (resource, executor, service): the entity's own permissions
    merged with the project's, the higher level wins. Project owners are entity admins.
    """
    permissions = set(entity_permissions)
    if project is not None and "admin" not in permissions:
        permissions |= await get_project_permissions(requester, project)
    return sorted(permissions)


async def owned_project_ids(session: AsyncSession, requester: UserDTO) -> set[str]:
    """IDs of the projects the requester owns: owners have admin on them without a policy."""
    stmt = select(project_owners.c.project_id).where(project_owners.c.user_id == UUID(_requester_id(requester)))
    return {str(project_id) for project_id in (await session.execute(stmt)).scalars()}


def require_enabled_project(project: Project | None) -> Project:
    """Resources and executors can only be added to an existing, enabled project."""
    if project is None:
        raise EntityNotFound("Project not found")
    if project.status != ModelStatus.ENABLED:
        raise EntityWrongState("Project is not enabled")
    return project
