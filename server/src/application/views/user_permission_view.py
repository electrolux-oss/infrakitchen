from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status as http_status

from core.permissions.dependencies import get_permission_service
from core.permissions.service import PermissionService
from core.sso.functions import get_logged_user
from core.users.model import UserDTO


router = APIRouter(dependencies=[Depends(get_logged_user)])


@router.get(
    "/user/policies",
    response_model=dict[str, str],
    response_description="Get user policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_user_policies(
    request: Request,
    service: PermissionService = Depends(get_permission_service),
):
    requester: UserDTO | None = request.state.user
    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    policies = await service.get_user_policies(user_id=requester.id)

    return policies
