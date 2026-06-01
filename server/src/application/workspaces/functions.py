import logging
import shutil
from typing import Any
from uuid import UUID

from core.constants.model import ModelActions
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO

log = logging.getLogger(__name__)


async def copy_resource_code(source_path: str, destination_path: str, logger: logging.Logger | Any = log) -> None:
    """
    Copy resource code from source to destination path.
    """
    logger.info(f"Copying resource code from {source_path} to {destination_path}")

    try:
        shutil.copytree(source_path, destination_path, dirs_exist_ok=True)
        logger.info(f"Resource code copied successfully to {destination_path}")
    except Exception as e:
        logger.error(f"Failed to copy resource code: {e}")
        raise e


async def delete_resource_code(path: str, logger: logging.Logger | Any = log) -> None:
    """
    Delete resource code at the specified path.
    """
    logger.info(f"Deleting resource code at {path}")

    try:
        shutil.rmtree(path)
        logger.info(f"Resource code at {path} deleted successfully")
    except Exception as e:
        logger.error(f"Failed to delete resource code: {e}")
        raise e


async def get_workspace_actions(requester: UserDTO, workspace_id: str | UUID) -> list[str]:
    """Get all actions available for a workspace based on user permissions."""
    requester_permissions = await user_entity_permissions(requester, workspace_id, "workspace")
    if "admin" not in requester_permissions:
        return []

    return [ModelActions.EDIT, ModelActions.DELETE]
