from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status

from .dependencies import get_resource_temp_state_service
from .schema import ResourceTempStateResponse
from .service import ResourceTempStateService

router = APIRouter()


@router.get(
    "/resource_temp_states/{id}",
    response_model=ResourceTempStateResponse,
    response_description="Get one entity state intermediate by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(id: str, service: ResourceTempStateService = Depends(get_resource_temp_state_service)):
    resource_temp_state = await service.get_by_id(id=id)
    if not resource_temp_state:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="ResourceTempState not found")
    return resource_temp_state


@router.get(
    "/resource_temp_states/resource/{resource_id}",
    response_model=ResourceTempStateResponse,
    response_description="Get one entity state intermediate by entity id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_resource_id(
    resource_id: str, service: ResourceTempStateService = Depends(get_resource_temp_state_service)
):
    resource_temp_state = await service.get_by_resource_id(resource_id=resource_id)
    if not resource_temp_state:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="ResourceTempState not found")
    return resource_temp_state


@router.delete(
    "/resource_temp_states/resource/{resource_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
)
async def delete_by_resource_id(
    resource_id: str, service: ResourceTempStateService = Depends(get_resource_temp_state_service)
):
    await service.delete_by_resource_id(resource_id=resource_id)
