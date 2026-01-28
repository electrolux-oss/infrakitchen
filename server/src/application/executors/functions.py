from uuid import UUID
from core.permissions.service import PermissionService


async def delete_executor_policies(
    executor_id: str | UUID,
    permission_service: PermissionService,
) -> None:
    await permission_service.delete_entity_permissions("executor", executor_id)
