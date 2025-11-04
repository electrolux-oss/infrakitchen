import json
import logging
import os

from core.audit_logs.handler import AuditLogHandler
from core.config import InfrakitchenConfig
from core.database import SessionLocal
from core.feature_flags.crud import FeatureFlagCRUD
from core.feature_flags.model import FeatureFlagDTO
from core.feature_flags.service import FeatureFlagService

logger = logging.getLogger(__name__)


async def init_feature_flags(session):
    feature_flag_service = FeatureFlagService(
        crud=FeatureFlagCRUD(session=session),
        audit_log_handler=AuditLogHandler(session=session, entity_name="feature_flag"),
    )

    existing_feature_flags = await feature_flag_service.get_all()
    existing_flags_by_name = {flag.name: flag for flag in existing_feature_flags}
    existing_flag_names = set(existing_flags_by_name.keys())

    root_dir = os.path.dirname(os.path.realpath(__file__))
    config_path = os.path.join(root_dir, "./default_configs.json")

    new_flags_to_create = set()
    config_flag_names = set()

    try:
        with open(config_path) as config_file:
            flag_configs = json.load(config_file)

            for flag_config in flag_configs:
                flag_name = flag_config["name"]
                config_flag_names.add(flag_name)

                if flag_name not in existing_flag_names:
                    new_flag = FeatureFlagDTO(name=flag_name, enabled=flag_config["enabled"], updated_by=None)
                    new_flags_to_create.add(new_flag)

    except Exception as e:
        logger.error(f"Cannot load default feature flags: {e}")
        raise ValueError("Wrong configuration for default feature flags") from e

    flags_to_remove = existing_flag_names - config_flag_names

    if flags_to_remove:
        for flag_name in flags_to_remove:
            flag_to_delete = existing_flags_by_name[flag_name]
            await feature_flag_service.delete(flag_to_delete)
            logger.debug(f"Removed feature flag: {flag_name}")

    if new_flags_to_create:
        for flag in new_flags_to_create:
            created_flag = await feature_flag_service.create(flag)
            logger.debug(f"Created feature flag: {created_flag.name} (enabled: {created_flag.enabled})")

    if flags_to_remove or new_flags_to_create:
        await session.commit()
        logger.info(f"Feature flags synchronized - Removed: {len(flags_to_remove)}, Added: {len(new_flags_to_create)}")
    else:
        logger.debug("No feature flag changes needed")


async def reload_feature_flags_configs():
    async with SessionLocal() as session:
        service = FeatureFlagService(
            crud=FeatureFlagCRUD(session=session),
            audit_log_handler=AuditLogHandler(session=session, entity_name="feature_flag"),
        )

        feature_flags = await service.get_all()
        for flag in feature_flags:
            setattr(InfrakitchenConfig, flag.config_name, flag.enabled)
            logger.debug(f"Feature flag {flag.name} reloaded with value {flag.enabled}")
