import logging

from core import UserDTO
from core.audit_logs.handler import AuditLogHandler
from core.feature_flags.crud import FeatureFlagCRUD
from core.feature_flags.model import FeatureFlagDTO, FeatureFlag
from core.utils.model_tools import model_db_dump

logger = logging.getLogger(__name__)


class FeatureFlagService:
    def __init__(
        self,
        crud: FeatureFlagCRUD,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud = crud
        self.audit_log_handler = audit_log_handler

    async def get_by_name(self, name: str) -> FeatureFlagDTO | None:
        feature_flag = await self.crud.get_by_name(name)
        if not feature_flag:
            raise ValueError(f"Feature flag with name {name} does not exist")
        return FeatureFlagDTO.model_validate(feature_flag)

    async def get_all(self) -> list[FeatureFlagDTO]:
        feature_flags = await self.crud.get_all()
        return [FeatureFlagDTO.model_validate(flag) for flag in feature_flags]

    async def update_config(self, new_feature_flag: FeatureFlagDTO, requester: UserDTO) -> FeatureFlagDTO:
        existing_feature_flag = await self.crud.get_by_name(new_feature_flag.name)
        if not existing_feature_flag:
            raise ValueError(f"Feature flag with name {new_feature_flag.name} does not exist")

        body = model_db_dump(new_feature_flag)

        existing_feature_flag.updated_by = requester.id
        updated_feature_flag = await self.crud.update(existing_feature_flag, body)

        await self.audit_log_handler.create_log(
            str(updated_feature_flag.id), requester.id, f"Set to ${new_feature_flag.enabled}"
        )
        return FeatureFlagDTO.model_validate(updated_feature_flag)

    async def create(self, feature_flag: FeatureFlagDTO):
        body = feature_flag.model_dump(exclude_unset=True)
        new_feature_flag = FeatureFlag(**body)
        self.crud.session.add(new_feature_flag)

        await self.crud.session.flush()
        await self.crud.refresh(new_feature_flag)
        return FeatureFlagDTO.model_validate(new_feature_flag)

    async def delete(self, feature_flag: FeatureFlagDTO):
        existing_feature_flag = await self.crud.get_by_name(feature_flag.name)
        if existing_feature_flag:
            await self.crud.delete(existing_feature_flag)
