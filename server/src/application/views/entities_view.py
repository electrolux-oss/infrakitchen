from fastapi import APIRouter
from core.utils.entities import get_all_entities

router = APIRouter()


@router.get(
    "/entities",
    response_description="Get list of available entities",
    response_model=list[str],
    response_model_by_alias=False,
)
async def get():
    return get_all_entities()
