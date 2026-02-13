from fastapi import APIRouter
from fastapi import status as http_status
from .model import ConstantModel


router = APIRouter()


@router.get(
    "/constants",
    response_model=dict[str, list[ConstantModel]],
    response_description="Get all constants",
    response_model_by_alias=False,
    status_code=http_status.HTTP_200_OK,
)
async def get_constants_api() -> dict[str, list[ConstantModel]]:
    # hardcoded values for now
    cloud_provider = [
        ConstantModel(name="aws", description="Amazon Web Services"),
        ConstantModel(name="gcp", description="Google Cloud Platform"),
        ConstantModel(name="azurerm", description="Microsoft Azure Resource Manager"),
    ]

    source_code_provider = [
        ConstantModel(name="github", description="GitHub"),
        ConstantModel(name="gitlab", description="GitLab"),
        ConstantModel(name="bitbucket", description="Bitbucket"),
    ]

    return {"cloud_provider": cloud_provider, "source_code_provider": source_code_provider}
