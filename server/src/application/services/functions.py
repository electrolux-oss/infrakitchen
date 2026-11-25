from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.projects.functions import merge_project_permissions
from application.services.model import Service
from core.constants.model import ModelActions
from core.errors import EntityNotFound
from core.users.functions import require_entity_write_access, user_entity_permissions
from core.users.model import UserDTO


async def assert_registry_integration(session: AsyncSession, integration_id: str | UUID, requester: UserDTO) -> None:
    integration_type = (
        await session.execute(select(Integration.integration_type).where(Integration.id == integration_id))
    ).scalar_one_or_none()
    if integration_type is None:
        raise EntityNotFound(f"Integration {integration_id} not found")
    if integration_type != "container_registry":
        raise ValueError("The image registry must be a container registry integration")
    await require_entity_write_access(requester, "integration", [integration_id])


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


async def get_service_permissions(requester: UserDTO, service_id: str | UUID, service: Service | None) -> list[str]:
    """
    Permissions are calculated from both service-level and project-level policies.
    Service owners are service admins.
    """
    requester_permissions = await user_entity_permissions(requester, service_id, "service")
    if await requester_is_service_owner(requester, service):
        requester_permissions = [*requester_permissions, "admin"]
    return await merge_project_permissions(requester, requester_permissions, service.project if service else None)


async def get_service_actions(
    requester: UserDTO,
    service_id: str | UUID,
    service: Service | None = None,
) -> list[str]:
    requester_permissions = await get_service_permissions(requester, service_id, service)

    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    actions: list[str] = [ModelActions.EDIT, ModelActions.BUILD]
    if "admin" in requester_permissions:
        actions.append(ModelActions.DELETE)
    return actions


async def requester_is_service_owner(requester: UserDTO, service: Service | None) -> bool:
    """Owners of the service, and owners of its parent project, both count as service owners."""
    if service is None:
        return False
    owner_ids = _get_owner_ids(service) + _get_project_owner_ids(service)
    if not owner_ids:
        return False
    return _requester_id(requester) in owner_ids
