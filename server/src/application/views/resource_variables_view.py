from fastapi import APIRouter, Depends, Query

from application.resources.dependencies import get_resource_service
from application.resources.schema import ResourceVariableSchema
from application.resources.service import ResourceService

router = APIRouter()


def get_parents_resource_list(parent_resources: str = Query(default=[])) -> list[str]:
    if parent_resources and parent_resources != '"[]"':
        return [p.strip() for p in parent_resources.split(",") if p.strip()]
    else:
        return []


@router.get(
    "/source_code_versions/{source_code_version_id}/variables",
    response_description="Get resource variables schema",
    response_model=list[ResourceVariableSchema],
)
async def get_resource_variables_schema(
    source_code_version_id: str,
    parent_resources: list[str] = Depends(get_parents_resource_list),
    resource_service: ResourceService = Depends(get_resource_service),
):
    """
    Get a entity's schema in json
    """

    variables_schema = await resource_service.get_variable_schema(source_code_version_id, parent_resources)

    return variables_schema
