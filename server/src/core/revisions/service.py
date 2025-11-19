import logging
from typing import Any

from core.errors import EntityNotFound

from .crud import RevisionCRUD
from .schema import RevisionResponse, RevisionShort


logger = logging.getLogger(__name__)


class RevisionService:
    """
    RevisionService implements all required business-logic. It uses additional services and utils as helpers
    e.g. RevisionCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: RevisionCRUD,
    ):
        self.crud: RevisionCRUD = crud

    async def get_by_id(self, revision_id: str) -> RevisionResponse | None:
        revision = await self.crud.get_by_id(revision_id)
        if revision is None:
            return None
        return RevisionResponse.model_validate(revision)

    async def get_all(self, **kwargs) -> list[RevisionResponse]:
        revisions = await self.crud.get_all(**kwargs)
        return [RevisionResponse.model_validate(revision) for revision in revisions]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def get_entity_revision(self, entity_id: str, revision_number: int) -> RevisionResponse:
        revision = await self.crud.get_revision_by_entity_and_number(entity_id, revision_number)
        if not revision:
            raise EntityNotFound("Revision not found")

        return RevisionResponse.model_validate(revision)

    async def get_entity_all_revisions(self, entity_id: str) -> list[RevisionShort]:
        revisions = await self.crud.get_entity_all_revisions(entity_id)
        return [
            RevisionShort.model_validate(
                {
                    **revision.__dict__,
                    "name": revision.data.get("name") if revision.data else None,
                    "description": revision.data.get("description") if revision.data else None,
                }
            )
            for revision in revisions
        ]

    async def delete_by_entity_id(self, entity_id: str) -> None:
        await self.crud.delete_by_entity_id(entity_id)
