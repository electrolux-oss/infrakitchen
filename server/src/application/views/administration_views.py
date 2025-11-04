from fastapi import APIRouter, Body, HTTPException, Request

from core.casbin.enforcer import CasbinEnforcer
from core.users.functions import user_is_super_admin

router = APIRouter()


@router.post(
    "/administration/reload_permissions",
    response_description="Reload all permissions",
    response_model_by_alias=False,
)
async def reload_permissions(request: Request, body=Body(...)):
    if not await user_is_super_admin(request.state.user):
        raise HTTPException(status_code=403, detail="Access denied")

    await CasbinEnforcer().send_reload_event()
    return {"status": "ok"}
