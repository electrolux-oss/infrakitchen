from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.executors.model import Executor
from application.projects.functions import merge_project_permissions
from application.projects.model import Project
from application.projects.query_options import build_project_query_options
from application.resources.model import Resource
from application.services.crud import ServiceCRUD
from application.services.functions import get_service_permissions
from application.services.model import Service
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO
from core.utils.model_tools import is_valid_uuid

# entities that inherit the policies and owners of the project they belong to
PROJECT_SCOPED_ENTITIES: dict[str, type[Resource] | type[Executor] | type[Service]] = {
    "resource": Resource,
    "executor": Executor,
    "service": Service,
}


async def get_entity_project(session: AsyncSession, entity_name: str, entity_id: str | UUID) -> Project | None:
    """The project (with its owners) a resource, executor or service belongs to, None for other entities."""
    model = PROJECT_SCOPED_ENTITIES.get(entity_name)
    if model is None or not is_valid_uuid(entity_id):
        return None
    stmt = (
        select(Project)
        .join(model, model.project_id == Project.id)
        .where(model.id == UUID(str(entity_id)))
        # only what the permission check reads: the id and the owners
        .options(*build_project_query_options({"id": None, "owners": {"id": None}}))
    )
    return (await session.execute(stmt)).unique().scalar_one_or_none()


async def entity_permissions_with_project(
    session: AsyncSession, requester: UserDTO, entity_name: str, entity_id: str | UUID
) -> list[str]:
    """
    The requester's permissions on an entity, including the ones inherited from its project
    for project-scoped entities (resources, executors, services).
    """
    if entity_name == "service":
        service = await ServiceCRUD(session).get_by_id(
            entity_id, fields={"owners": {"id": None}, "project": {"id": None, "owners": {"id": None}}}
        )
        return await get_service_permissions(requester, entity_id, service)
    permissions = await user_entity_permissions(requester, entity_id, entity_name)
    if "admin" in permissions or entity_name not in PROJECT_SCOPED_ENTITIES:
        return permissions
    project = await get_entity_project(session, entity_name, entity_id)
    return await merge_project_permissions(requester, permissions, project)
