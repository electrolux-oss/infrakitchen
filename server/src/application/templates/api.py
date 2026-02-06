from typing import Any, Literal
from application.templates.service import TemplateService
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.registry import mcp_group
from .schema import TemplateCreate, TemplateResponse, TemplateTreeResponse, TemplateUpdate
from .dependencies import get_template_service

router = APIRouter()


@router.get(
    "/templates/{template_id}",
    response_model=TemplateResponse,
    response_description="Get one template by id",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(get_one_group, "templates", param_renames={"id": "template_id"})
async def get_by_id(template_id: str, service: TemplateService = Depends(get_template_service)):
    entity = await service.get_by_id(template_id=template_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Template not found")
    return entity


@router.get(
    "/templates",
    response_model=list[dict[str, Any]],
    response_description="Get all templates",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(list_entities_group, "templates")
async def get_all(
    response: Response,
    service: TemplateService = Depends(get_template_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))

    headers = {"Content-Range": f"templates 0-{len(result)}/{total}"}
    response.headers.update(headers)

    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/templates",
    response_model=TemplateResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: TemplateCreate, service: TemplateService = Depends(get_template_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(template=body, requester=requester)

    return entity


@router.patch(
    "/templates/{template_id}",
    response_model=TemplateResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    template_id: str,
    body: TemplateUpdate,
    service: TemplateService = Depends(get_template_service),
):
    requester: UserDTO = request.state.user
    if ModelActions.EDIT not in await service.get_actions(template_id=template_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")
    entity = await service.update(template_id=template_id, template=body, requester=requester)
    return entity


@router.patch("/templates/{template_id}/actions", response_model=TemplateResponse, status_code=http_status.HTTP_200_OK)
async def patch_action(
    request: Request,
    template_id: str,
    body: PatchBodyModel,
    service: TemplateService = Depends(get_template_service),
):
    requester: UserDTO = request.state.user
    actions_list = list(map(lambda x: x.value, ModelActions))

    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    if body.action not in await service.get_actions(template_id=template_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")

    entity = await service.patch(template_id=template_id, body=body, requester=requester)

    return entity


@router.delete("/templates/{template_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, template_id: str, service: TemplateService = Depends(get_template_service)):
    requester: UserDTO = request.state.user
    if ModelActions.DELETE not in await service.get_actions(template_id=template_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")

    await service.delete(template_id=template_id, requester=requester)


@router.get(
    "/templates/{template_id}/actions",
    response_model=list[str],
    response_description="Get user allowed actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, template_id: str, service: TemplateService = Depends(get_template_service)):
    requester = request.state.user
    return await service.get_actions(template_id=template_id, requester=requester)


@router.get(
    "/templates/{template_id}/tree/{direction}",
    response_model=TemplateTreeResponse,
    response_description="Get tree for a template",
    status_code=http_status.HTTP_200_OK,
)
async def get_tree(
    template_id: str,
    direction: Literal["parents", "children"],
    service: TemplateService = Depends(get_template_service),
):
    tree = await service.get_tree(template_id=template_id, direction=direction)
    return tree
