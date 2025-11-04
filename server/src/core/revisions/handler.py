import json
import logging
from typing import Any
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_models import BaseRevision
from core.database import to_dict
from core.models.encrypted_secret import mask_secret_values
from core.utils.json_encoder import JsonEncoder

from .model import Revision

logger = logging.getLogger(__name__)


class RevisionHandler:
    def __init__(self, session: AsyncSession, entity_name: str, original_entity_instance: dict[str, Any] | None = None):
        self.session: AsyncSession = session
        self.entity_name: str = entity_name
        self.original_entity_instance_dump: dict[str, Any] | None = original_entity_instance

    @staticmethod
    def remove_hidden_from_user_fields(data: dict[str, Any]) -> None:
        """
        Remove hidden fields from the data dictionary.
        :param data: Dictionary containing the data to be modified.
        """
        for key in list(data.keys()):
            if key.startswith("_"):
                del data[key]
            elif key == "state":
                del data[key]
            elif key == "status":
                del data[key]
            elif key == "created_at":
                del data[key]
            elif key == "updated_at":
                del data[key]
            elif key == "revision_number":
                del data[key]

    async def get_next_revision(self, entity_id: UUID | str) -> int:
        statement = (
            select(Revision)
            .where(
                Revision.model == self.entity_name,
                Revision.entity_id == str(entity_id),
            )
            .order_by(Revision.revision_number.desc())
            .limit(1)
        )
        result = await self.session.execute(statement)
        revision = result.scalar_one_or_none()

        if revision:
            return revision.revision_number + 1
        return 1

    async def handle_revision(self, entity_instance: BaseRevision) -> None:
        dumped_model = to_dict(entity_instance)
        self.remove_hidden_from_user_fields(dumped_model)
        mask_secret_values(dumped_model)

        if self.original_entity_instance_dump is not None:
            # skip validation if entity is not changed
            previous_entity_dump = self.original_entity_instance_dump

            self.remove_hidden_from_user_fields(previous_entity_dump)
            mask_secret_values(previous_entity_dump)

            if dumped_model == previous_entity_dump:
                logger.info("No changes detected, skipping revision")
                return
        revision_number = await self.get_next_revision(entity_instance.id)
        revision = Revision(
            model=self.entity_name,
            revision_number=revision_number,
            entity_id=entity_instance.id,
            data=json.loads(json.dumps(dumped_model, cls=JsonEncoder)),
        )

        entity_instance.revision_number = revision.revision_number
        self.session.add(revision)
