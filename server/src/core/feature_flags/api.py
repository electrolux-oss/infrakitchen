from fastapi import APIRouter, Depends, HTTPException, Request
from core.feature_flags.dependencies import get_feature_flag_service
from core.feature_flags.enforcer import FeatureFlagEnforcer
from core.feature_flags.model import FeatureFlagDTO
from core.feature_flags.service import FeatureFlagService
from core.users.functions import user_is_super_admin
from fastapi import status as http_status

router = APIRouter()


@router.get(
    "/feature_flags",
    response_description="Manage feature flag",
    response_model_by_alias=False,
)
async def get_feature_flags(request: Request, service: FeatureFlagService = Depends(get_feature_flag_service)):
    if not await user_is_super_admin(request.state.user):
        raise HTTPException(status_code=403, detail="Access denied")

    feature_flags = await service.get_all()
    return {"status": "ok", "data": feature_flags}


@router.patch("/feature_flags", status_code=http_status.HTTP_200_OK, response_model=FeatureFlagDTO)
async def config_feature_flag(
    request: Request, feature_flag: FeatureFlagDTO, service: FeatureFlagService = Depends(get_feature_flag_service)
):
    if not await user_is_super_admin(request.state.user):
        raise HTTPException(status_code=403, detail="Access denied")

    updated_flags = await service.update_config(feature_flag, request.state.user)

    await FeatureFlagEnforcer().send_reload_configs_event()
    return updated_flags


@router.post(
    "/feature_flags/reload",
    response_description="Reload all feature flags",
    response_model_by_alias=False,
)
async def reload_feature_flags(request: Request):
    if not await user_is_super_admin(request.state.user):
        raise HTTPException(status_code=403, detail="Access denied")

    await FeatureFlagEnforcer().send_reload_configs_event()
