from uuid import UUID

from application.services.model import Service
from core.constants.model import ModelActions
from core.users.functions import user_api_permission, user_entity_permissions
from core.users.functions import user_is_super_admin
from core.users.model import UserDTO


def _requester_id(requester: UserDTO) -> str:
    if requester.primary_account:
        return str(requester.primary_account[0].id)
    return str(requester.id)


def _get_owner_ids(service: Service) -> list[str]:
    return [str(owner.id) for owner in service.owners]


def _get_project_owner_ids(service: Service) -> list[str]:
    if service.project is None:
        return []
    return [str(owner.id) for owner in service.project.owners]


async def get_service_actions(
    requester: UserDTO,
    service_id: str | UUID,
    service: Service | None = None,
) -> list[str]:
    if await user_is_super_admin(requester):
        is_service_admin = True
    else:
        is_service_admin = False

    requester_permissions = await user_entity_permissions(requester, service_id, "service")

    if "admin" in requester_permissions:
        is_service_admin = True

    apis = await user_api_permission(requester, "service")
    requester_permissions = [apis["api:service"]] if apis else []

    if "admin" in requester_permissions:
        is_service_admin = True

    if await requester_is_service_owner(requester, service):
        is_service_admin = True

    if not is_service_admin:
        return []

    return [ModelActions.EDIT, ModelActions.DELETE]


async def requester_is_service_owner(requester: UserDTO, service: Service | None) -> bool:
    """Owners of the service, and owners of its parent project, both count as service owners."""
    if service is None:
        return False
    owner_ids = _get_owner_ids(service) + _get_project_owner_ids(service)
    if not owner_ids:
        return False
    return _requester_id(requester) in owner_ids
