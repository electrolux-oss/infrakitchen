from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from core.permissions.dependencies import get_permission_service
from core.users.model import UserDTO


async def create_role(session: AsyncSession, role_name: str, user_ids: list[UUID], requester: UserDTO) -> None:
    permission_service = get_permission_service(session=session)

    for user_id in user_ids:
        await permission_service.create_role(
            role_name=role_name, user_id=user_id, requester=requester, reload_permission=False
        )
