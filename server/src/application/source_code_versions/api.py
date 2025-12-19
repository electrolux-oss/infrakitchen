from typing import Any
from uuid import UUID
from application.source_code_versions.functions import filter_template_outputs
from application.source_code_versions.service import SourceCodeVersionService
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import (
    SourceCodeVersionCreate,
    SourceCodeVersionResponse,
    SourceCodeVersionUpdate,
    SourceConfigResponse,
    SourceConfigTemplateReferenceResponse,
    SourceConfigUpdate,
    SourceConfigUpdateWithId,
    SourceOutputConfigResponse,
    SourceOutputConfigTemplateResponse,
)
from .dependencies import get_source_code_version_service

router = APIRouter()


@router.get(
    "/source_code_versions/{source_code_version_id}",
    response_model=SourceCodeVersionResponse,
    response_description="Get one source_code_version by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(
    source_code_version_id: str, service: SourceCodeVersionService = Depends(get_source_code_version_service)
):
    entity = await service.get_by_id(source_code_version_id=source_code_version_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="SourceCodeVersion not found")
    return entity


@router.get(
    "/source_code_versions",
    response_model=list[dict[str, Any]],
    response_description="Get all source_code_versions",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"source_code_versions 0-{len(result)}/{total}"}
    response.headers.update(headers)

    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/source_code_versions",
    response_model=SourceCodeVersionResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(
    request: Request,
    body: SourceCodeVersionCreate,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(source_code_version=body, requester=requester)

    return entity


@router.patch(
    "/source_code_versions/{source_code_version_id}",
    response_model=SourceCodeVersionResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    source_code_version_id: str,
    body: SourceCodeVersionUpdate,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
):
    requester: UserDTO = request.state.user
    if ModelActions.EDIT not in await service.get_actions(
        source_code_version_id=source_code_version_id, requester=requester
    ):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")

    entity = await service.update(
        source_code_version_id=source_code_version_id, source_code_version=body, requester=requester
    )
    return entity


@router.patch(
    "/source_code_versions/{source_code_version_id}/actions",
    response_model=SourceCodeVersionResponse,
    status_code=http_status.HTTP_200_OK,
)
async def patch_action(
    request: Request,
    source_code_version_id: str,
    body: PatchBodyModel,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
):
    requester: UserDTO = request.state.user
    actions_list = list(map(lambda x: x.value, ModelActions))

    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    if body.action not in await service.get_actions(source_code_version_id=source_code_version_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")

    entity = await service.patch(source_code_version_id=source_code_version_id, body=body, requester=requester)

    return entity


@router.delete("/source_code_versions/{source_code_version_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(
    request: Request,
    source_code_version_id: str,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
):
    requester: UserDTO = request.state.user

    if ModelActions.DELETE not in await service.get_actions(
        source_code_version_id=source_code_version_id, requester=requester
    ):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")

    await service.delete(source_code_version_id=source_code_version_id, requester=requester)


@router.get(
    "/source_code_versions/{source_code_version_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(
    request: Request,
    source_code_version_id: str,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
):
    requester = request.state.user
    return await service.get_actions(
        source_code_version_id=source_code_version_id,
        requester=requester,
    )


# Variable and Output Configs
@router.get(
    "/source_code_versions/{source_code_version_id}/configs",
    response_model=list[SourceConfigResponse],
    response_description="Get configs for a source code version",
    status_code=http_status.HTTP_200_OK,
)
async def get_configs(
    source_code_version_id: str,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
) -> list[SourceConfigResponse]:
    configs = await service.get_configs_by_scv_id(source_code_version_id=source_code_version_id)
    return configs


@router.get(
    "/source_code_versions/{source_code_version_id}/configs/{config_id}",
    response_model=SourceConfigResponse,
    response_description="Get a config by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_config_by_id(
    config_id: str,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
) -> SourceConfigResponse:
    config = await service.get_config_by_id(config_id=config_id)
    if not config:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Config not found")
    return config


@router.put(
    "/source_code_versions/{source_code_version_id}/configs/{config_id}",
    response_model=SourceConfigResponse,
    response_description="Update a config by id",
    status_code=http_status.HTTP_200_OK,
)
async def update_config_by_id(
    request: Request,
    config_id: str,
    source_code_version_id: str,
    body: SourceConfigUpdate,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
) -> SourceConfigResponse:
    requester: UserDTO = request.state.user

    if ModelActions.EDIT not in await service.get_actions(
        source_code_version_id=source_code_version_id, requester=requester
    ):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")

    config = await service.update_config(config_id=config_id, config=body)
    return SourceConfigResponse.model_validate(config)


@router.put(
    "/source_code_versions/{source_code_version_id}/configs",
    response_model=list[SourceConfigResponse],
    response_description="Update a configs",
    status_code=http_status.HTTP_200_OK,
)
async def update_configs(
    request: Request,
    source_code_version_id: str,
    body: list[SourceConfigUpdateWithId],
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
) -> list[SourceConfigResponse]:
    requester: UserDTO = request.state.user

    if ModelActions.EDIT not in await service.get_actions(
        source_code_version_id=source_code_version_id, requester=requester
    ):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")

    return await service.update_configs(source_code_version_id=source_code_version_id, configs=body)


@router.get(
    "/source_code_versions/{source_code_version_id}/outputs",
    response_model=list[SourceOutputConfigResponse],
    response_description="Get output configs for a source code version",
    status_code=http_status.HTTP_200_OK,
)
async def get_outputs(
    source_code_version_id: str,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
) -> list[SourceOutputConfigResponse]:
    outputs = await service.get_output_configs_by_scv_id(source_code_version_id=source_code_version_id)
    return outputs


@router.get(
    "/source_code_versions/template/{template_id}/outputs",
    response_model=list[SourceOutputConfigTemplateResponse],
    response_description="Get output configs for a template",
    status_code=http_status.HTTP_200_OK,
)
async def get_outputs_by_template(
    template_id: UUID,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
) -> list[SourceOutputConfigTemplateResponse]:
    outputs = await service.get_output_configs_by_template_id(template_id=template_id)
    return filter_template_outputs(outputs=outputs)


@router.get(
    "/source_code_versions/template/{template_id}/references",
    response_model=list[SourceConfigTemplateReferenceResponse],
    response_description="Get reference output configs for a template",
    status_code=http_status.HTTP_200_OK,
)
async def get_reference_outputs_by_template(
    template_id: UUID,
    service: SourceCodeVersionService = Depends(get_source_code_version_service),
) -> list[SourceConfigTemplateReferenceResponse]:
    outputs = await service.get_template_config_references_by_template_id(template_id=template_id)
    return outputs
