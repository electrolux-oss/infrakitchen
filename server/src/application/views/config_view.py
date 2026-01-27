from fastapi import APIRouter, Depends

from core.auth_providers.dependencies import get_auth_provider_service
from core.auth_providers.service import AuthProviderService
from core.config import InfrakitchenConfig

router = APIRouter()


@router.get(
    "/configs/auth_providers",
    response_description="Get Infrakitchen auth providers",
    response_model=list[str],
    response_model_by_alias=False,
)
async def get(service: AuthProviderService = Depends(get_auth_provider_service)):
    enabled_providers = await service.get_all(filter={"enabled": True})
    return [provider.auth_provider for provider in enabled_providers]


@router.get(
    "/configs/global",
    response_description="Get Infrakitchen global config",
    response_model=dict,
    response_model_by_alias=False,
)
async def get_global_ui_config():
    return InfrakitchenConfig().to_dict()
