from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status as http_status

from core.revisions.service import RevisionService
from core.users.model import UserDTO
from core.users.functions import user_has_access_to_entity
from .schema import RevisionResponse, RevisionShort
from .dependencies import get_revision_service

router = APIRouter()


@router.get(
    "/revisions/{entity_id}",
    response_model=list[RevisionShort],
    response_description="Get revisions for a revision",
    status_code=http_status.HTTP_200_OK,
)
async def get_all_entity_revisions(
    request: Request,
    entity_id: str,
    service: RevisionService = Depends(get_revision_service),
):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_entity(requester, entity_id, action="write", entity_name="resource"):
        raise HTTPException(status_code=403, detail="Access denied")

    revision = await service.get_entity_all_revisions(entity_id=entity_id)
    return revision


@router.get(
    "/revisions/{entity_id}/{revision_number}",
    response_model=RevisionResponse,
    response_description="Get revisions for a revision",
    status_code=http_status.HTTP_200_OK,
)
async def get_entity_revision_by_number(
    request: Request,
    entity_id: str,
    revision_number: int,
    service: RevisionService = Depends(get_revision_service),
):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_entity(requester, entity_id, action="write", entity_name="resource"):
        raise HTTPException(status_code=403, detail="Access denied")

    revision = await service.get_entity_revision(entity_id=entity_id, revision_number=revision_number)
    return revision
