from fastapi import APIRouter, Depends, Response
from fastapi import status as http_status
from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.registry import mcp_group
from .model import CloudResourceModel
from .controller import CloudResourcesCRUD
from .dependencies import get_entities_crud

router = APIRouter()


@router.get(
    "/cloud_resources/{resource_name}",
    response_model=CloudResourceModel,
    response_description="Get one cloud resource by id",
    response_model_by_alias=False,
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(get_one_group, "cloud_resources", param_renames={"id": "resource_name"})
async def get_one(resource_name: str, entities: CloudResourcesCRUD = Depends(get_entities_crud)):
    entity = await entities.get_one(resource_name)
    return entity


@router.get(
    "/cloud_resources",
    response_model=list[CloudResourceModel],
    response_description="Get all cloud resources",
    response_model_by_alias=False,
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(list_entities_group, "cloud_resources")
async def get_all(
    response: Response,
    entities: CloudResourcesCRUD = Depends(get_entities_crud),
):
    entities_list = await entities.get_many(response)

    return entities_list
