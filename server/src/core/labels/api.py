from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from .service import LabelsService
from .dependencies import get_labels_service
from ..utils.entities import get_all_entities

router = APIRouter()


@router.get(
    "/labels",
    response_model=list[str],
    response_description="Get all unique labels",
    status_code=http_status.HTTP_200_OK,
)
async def get_all_labels(
    service: LabelsService = Depends(get_labels_service),
):
    """Get all unique labels from across all models that have labels."""
    return await service.get_all_labels()


@router.get(
    "/labels/{entity}",
    response_model=list[str],
    response_description="Get labels by entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_labels_by_entity(
    entity: str,
    service: LabelsService = Depends(get_labels_service),
):
    """Get labels for specific entity type (e.g. resource, template, etc.)"""
    supported_entities = get_all_entities()
    if entity not in supported_entities:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Entity not supported")

    return await service.get_labels(entity=entity)
