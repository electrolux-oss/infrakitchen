from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.resources.crud import ResourceCRUD
from application.resources.dependencies import get_resource_service
from application.resources.task import ResourceTask
from application.source_code_versions.crud import SourceCodeVersionCRUD
from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.task import SourceCodeVersionTask
from application.source_codes.crud import SourceCodeCRUD
from application.source_codes.dependencies import get_source_code_service
from application.source_codes.task import SourceCodeTask
from application.storages.crud import StorageCRUD
from application.storages.task import StorageTask
from application.tools.secret_manager import get_secret_manager
from application.workspaces.crud import WorkspaceCRUD
from application.workspaces.task import WorkspaceTask
from core import EntityLogger
from core.constants.model import ModelActions
from core.errors import CannotProceed
from application.resource_temp_state.crud import ResourceTempStateCrud
from application.resource_temp_state.model import ResourceTempStateDTO
from core.tasks.crud import TaskEntityCRUD
from core.tasks.handler import TaskHandler
from core.users.model import UserDTO
from core.utils.event_sender import EventSender


async def get_source_code_task(
    session: AsyncSession, obj_id: UUID, user: UserDTO, action: ModelActions, trace_id: str | None = None
):
    crud_source_code = SourceCodeCRUD(session=session)
    event_sender = EventSender(entity_name="source_code")

    source_code_instance = await crud_source_code.get_by_id(obj_id)
    if not source_code_instance:
        raise CannotProceed(f"Source code {obj_id} not found")

    task_handler = TaskHandler(
        TaskEntityCRUD(session=session), entity_name="source_code", entity_id=source_code_instance.id, user=user
    )

    return SourceCodeTask(
        session=session,
        crud_source_code=crud_source_code,
        source_code_instance=source_code_instance,
        task_handler=task_handler,
        logger=EntityLogger(
            entity_name="source_code",
            entity_id=source_code_instance.id,
            revision_number=int(source_code_instance.revision_number),
            trace_id=trace_id,
        ),
        user=user,
        event_sender=event_sender,
        action=action,
    )


async def get_source_code_version_task(
    session: AsyncSession, obj_id: UUID, user: UserDTO, action: ModelActions, trace_id: str | None = None
):
    crud_source_code_version = SourceCodeVersionCRUD(session=session)
    source_code_service = get_source_code_service(session=session)
    event_sender = EventSender(entity_name="source_code_version")

    source_code_version_instance = await crud_source_code_version.get_by_id(obj_id)
    if not source_code_version_instance:
        raise CannotProceed(f"Source code {obj_id} not found")

    source_code_instance = await source_code_service.get_dto_by_id(source_code_version_instance.source_code_id)

    if not source_code_instance:
        raise CannotProceed(f"Source code {source_code_version_instance.source_code_id} not found")

    task_handler = TaskHandler(
        TaskEntityCRUD(session=session),
        entity_name="source_code_version",
        entity_id=source_code_version_instance.id,
        user=user,
    )

    return SourceCodeVersionTask(
        session=session,
        crud_source_code_version=crud_source_code_version,
        source_code_version_service=get_source_code_version_service(session=session),
        source_code_version_instance=source_code_version_instance,
        source_code_instance=source_code_instance,
        task_handler=task_handler,
        logger=EntityLogger(
            entity_name="source_code_version",
            entity_id=str(source_code_version_instance.id),
            revision_number=int(source_code_version_instance.revision_number),
            trace_id=trace_id,
        ),
        user=user,
        event_sender=event_sender,
        action=action,
    )


async def get_storage_task(
    session: AsyncSession, obj_id: UUID, user: UserDTO, action: ModelActions, trace_id: str | None = None
):
    crud_storage = StorageCRUD(session=session)
    event_sender = EventSender(entity_name="storage")

    storage_instance = await crud_storage.get_by_id(obj_id)
    if not storage_instance:
        raise CannotProceed(f"Storage {obj_id} not found")

    task_handler = TaskHandler(
        TaskEntityCRUD(session=session), entity_name="storage", entity_id=storage_instance.id, user=user
    )

    return StorageTask(
        session=session,
        crud_storage=crud_storage,
        storage_instance=storage_instance,
        task_handler=task_handler,
        logger=EntityLogger(
            entity_name="storage",
            entity_id=storage_instance.id,
            revision_number=int(storage_instance.revision_number),
            trace_id=trace_id,
        ),
        user=user,
        event_sender=event_sender,
        action=action,
    )


async def get_resource_task(
    session: AsyncSession, obj_id: UUID, user: UserDTO, action: ModelActions, trace_id: str | None = None
) -> ResourceTask:
    crud_resource = ResourceCRUD(session=session)
    crud_resource_temp_state = ResourceTempStateCrud(session=session)
    event_sender = EventSender(entity_name="resource")
    workspace_event_sender = EventSender(entity_name="workspace")
    source_code_version_service = get_source_code_version_service(session=session)

    resource_instance = await crud_resource.get_by_id(obj_id)
    if not resource_instance:
        raise CannotProceed(f"Resource {obj_id} not found")

    temp_state_instance_pydantic = None
    temp_state_instance = await crud_resource_temp_state.get_by_resource_id(obj_id)
    if temp_state_instance is not None:
        temp_state_instance_pydantic = ResourceTempStateDTO.model_validate(temp_state_instance)

    task_handler = TaskHandler(
        TaskEntityCRUD(session=session), entity_name="resource", entity_id=resource_instance.id, user=user
    )
    r_logger = EntityLogger(
        entity_name="resource",
        entity_id=resource_instance.id,
        revision_number=int(resource_instance.revision_number),
        trace_id=trace_id,
    )

    secret_manager = get_secret_manager(
        logger=r_logger,
        integration_service=get_integration_service(session=session),
    )

    return ResourceTask(
        session=session,
        crud_resource=crud_resource,
        resource_service=get_resource_service(session=session),
        resource_instance=resource_instance,
        resource_temp_state_instance=temp_state_instance_pydantic,
        source_code_version_service=source_code_version_service,
        task_handler=task_handler,
        logger=r_logger,
        secret_manager=secret_manager,
        user=user,
        event_sender=event_sender,
        workspace_event_sender=workspace_event_sender,
        action=action,
    )


async def get_workspace_task(
    session: AsyncSession, obj_id: UUID, user: UserDTO, action: ModelActions, trace_id: str | None = None
):
    resource_service = get_resource_service(session=session)
    crud_workspace = WorkspaceCRUD(session=session)
    workspace_event_sender = EventSender(entity_name="workspace")

    resource_instance = await resource_service.get_dto_by_id(obj_id)
    if not resource_instance:
        raise CannotProceed(f"Resource {obj_id} not found")

    if not resource_instance.workspace_id:
        raise CannotProceed(f"Resource {obj_id} is not associated with a workspace")

    workspace_instance = await crud_workspace.get_by_id(resource_instance.workspace_id)
    if not workspace_instance:
        raise CannotProceed(f"Workspace {obj_id} not found")

    w_logger = EntityLogger(
        entity_name="workspace",
        entity_id=str(workspace_instance.id),
        trace_id=trace_id,
    )

    resource_task = await get_resource_task(
        session=session, obj_id=resource_instance.id, user=user, action=ModelActions.DRYRUN_WITH_TEMP_STATE
    )

    task_handler = TaskHandler(
        TaskEntityCRUD(session=session), entity_name="workspace", entity_id=workspace_instance.id, user=user
    )

    return WorkspaceTask(
        session=session,
        crud_workspace=crud_workspace,
        resource_task_controller=resource_task,
        workspace_instance=workspace_instance,
        task_handler=task_handler,
        logger=w_logger,
        user=user,
        event_sender=workspace_event_sender,
        action=action,
    )
