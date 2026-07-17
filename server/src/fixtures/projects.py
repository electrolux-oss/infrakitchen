from uuid import UUID
from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession
from application.projects.dependencies import get_project_service
from application.projects.schema import ProjectCreate
from application.common.schema import DependencyConfig, DependencyTag
from core.users.model import UserDTO


async def insert_projects(session: AsyncSession, env: str, workspace_id: UUID, user: UserDTO):
    project_service = get_project_service(session=session)

    project = ProjectCreate(
        name=f"{env}",
        description=get_sentence(),
        labels=[f"{env}-label"],
        owners=[user.id],
        workspace_id=workspace_id,
        dependency_tags=[
            DependencyTag(name="project", value=f"{env}", inherited_by_children=True),
        ],
        dependency_config=[
            DependencyConfig(name="project_name", value=f"{env}", inherited_by_children=True),
        ],
    )

    return await project_service.create_project(project=project, requester=user)
