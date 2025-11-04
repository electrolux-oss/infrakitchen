from collections.abc import AsyncGenerator
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import FileResponse

from application.resources.crud import ResourceCRUD

from application.workers.utils import get_resource_task
from core.constants.model import ModelActions
from core.database import SessionLocal
from core.errors import EntityNotFound
from core.users.model import UserDTO

router = APIRouter()


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


@router.get(
    "/resources/{resource_id}/download",
    response_description="Download resource source code",
)
async def get_resource_source_code(
    request: Request,
    resource_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    requester: UserDTO = request.state.user
    crud_resource = ResourceCRUD(session=session)
    resource_instance = await crud_resource.get_by_id(resource_id)
    if not resource_instance:
        raise EntityNotFound(f"Resource {resource_id} not found")

    task_controller = await get_resource_task(
        session=session,
        obj_id=resource_instance.id,
        user=requester,
        action=ModelActions.DOWNLOAD,
    )
    debug_package_path = await task_controller.debug()
    return FileResponse(debug_package_path)
