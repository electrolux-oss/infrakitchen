from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status as http_status

from core.sso.functions import get_logged_user
from core.users.functions import user_apis_permissions
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
):
    requester: UserDTO | None = request.state.user
    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    policies = await user_apis_permissions(requester)

    return policies
