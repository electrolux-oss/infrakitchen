import logging
from typing import Any

from application.integrations.service import IntegrationService
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from core.database import to_dict
from core.errors import DependencyError, EntityNotFound, EntityWrongState
from core.logs.service import LogService
from core.revisions.handler import RevisionHandler
from core.tasks.service import TaskEntityService
from core.users.functions import user_entity_permissions
from core.utils.entity_state_handler import delete_entity, execute_entity, recreate_entity
from core.utils.event_sender import EventSender
from .crud import StorageCRUD
from .schema import StorageCreate, StorageResponse, StorageUpdate
from core.users.model import UserDTO

from core.constants import ModelStatus, ModelState

logger = logging.getLogger(__name__)


class StorageService:
    """
    StorageService implements all required business-logic. It uses additional services and utils as helpers
    e.g. StorageCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: StorageCRUD,
        integration_service: IntegrationService,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        log_service: LogService,
        task_service: TaskEntityService,
    ):
        self.crud: StorageCRUD = crud
        self.integration_service: IntegrationService = integration_service
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.log_service: LogService = log_service
        self.task_service: TaskEntityService = task_service

    async def get_by_id(self, storage_id: str) -> StorageResponse | None:
        storage = await self.crud.get_by_id(storage_id)
        if storage is None:
            return None
        return StorageResponse.model_validate(storage)

    async def get_all(self, **kwargs) -> list[StorageResponse]:
        storages = await self.crud.get_all(**kwargs)
        return [StorageResponse.model_validate(storage) for storage in storages]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(self, storage: StorageCreate, requester: UserDTO) -> StorageResponse:
        """
        Create a new storage.
        :param storage: StorageCreate to create
        :param requester: User who creates the storage
        :return: Created storage
        """
        storage_providers = ["aws", "azurerm", "gcp"]
        if storage.storage_type == "tofu":
            if storage.storage_provider not in storage_providers:
                raise ValueError("Invalid storage provider, must be one of 'aws', 'azurerm', 'gcp'")

        body = storage.model_dump(exclude_unset=True)
        body["created_by"] = requester.id
        if not storage.integration_id:
            raise ValueError("Integration ID is required to create a storage")

        integration = await self.integration_service.get_by_id(storage.integration_id)
        if not integration:
            raise ValueError("Integration not found")

        if integration.status != ModelStatus.ENABLED:
            raise DependencyError(
                "Integration must be enabled to create a storage", metadata=[integration.model_dump()]
            )

        new_storage = await self.crud.create(body)
        new_storage.state = ModelState.PROVISION
        new_storage.status = ModelStatus.READY
        result = await self.crud.get_by_id(new_storage.id)

        await self.revision_handler.handle_revision(new_storage)
        await self.audit_log_handler.create_log(new_storage.id, requester.id, ModelActions.CREATE)
        response = StorageResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return response

    async def update(self, storage_id: str, storage: StorageUpdate, requester: UserDTO) -> StorageResponse:
        """
        Update an existing storage.
        :param storage_id: ID of the storage to update
        :param storage: Storage to update
        :param requester: User who updates the storage
        :return: Updated storage
        """
        body = storage.model_dump(exclude_unset=True)
        existing_storage = await self.crud.get_by_id(storage_id)

        if not existing_storage:
            raise EntityNotFound("Storage not found")

        if existing_storage.status in [ModelStatus.IN_PROGRESS, ModelStatus.QUEUED]:
            logger.error(f"Entity has wrong status for updating {existing_storage.status}")
            raise ValueError(f"Entity has wrong status for updating {existing_storage.status}")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_storage)

        if existing_storage.state in [ModelState.DESTROY, ModelState.DESTROYED]:
            raise ValueError(f"Entity cannot be updated, has wrong state {existing_storage.state}")

        existing_storage.status = ModelStatus.READY

        await self.crud.update(existing_storage, body)

        await self.audit_log_handler.create_log(storage_id, requester.id, ModelActions.UPDATE)
        await self.revision_handler.handle_revision(existing_storage)
        await self.crud.refresh(existing_storage)

        response = StorageResponse.model_validate(existing_storage)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return response

    async def patch_action(self, storage_id, body: PatchBodyModel, requester: UserDTO) -> StorageResponse:
        """
        Patch an existing storage.
        :param storage_id: ID of the storage to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the storage
        :return: Patched storage
        """
        existing_storage = await self.crud.get_by_id(storage_id)
        if not existing_storage:
            raise EntityNotFound("Storage not found")

        if existing_storage.status in [ModelStatus.IN_PROGRESS]:
            logger.error(f"Entity has wrong status for patching {existing_storage.status}")
            raise EntityWrongState(f"Entity has wrong status for patching {existing_storage.status}")

        await self.audit_log_handler.create_log(existing_storage.id, requester.id, body.action)

        match body.action:
            case ModelActions.RETRY:
                if existing_storage.status == ModelStatus.QUEUED:
                    await self.event_sender.send_task(
                        existing_storage.id,
                        requester=requester,
                        trace_id=self.audit_log_handler.trace_id,
                        action=ModelActions.EXECUTE,
                    )
                else:
                    raise EntityWrongState("Only storages in QUEUED status can be retried")

            case ModelActions.DESTROY:
                dependencies = await self.crud.get_dependencies(existing_storage)
                if dependencies:
                    raise DependencyError(
                        "Cannot delete a storage that has dependencies, dependencies",
                        metadata=[
                            {
                                "id": dependency.id,
                                "name": dependency.name,
                                "_entity_name": dependency.type,
                            }
                            for dependency in dependencies
                        ],
                    )

                if existing_storage.state == ModelState.DESTROYED:
                    raise EntityWrongState("Storage is already destroyed")

                elif existing_storage.state == ModelState.PROVISIONED:
                    existing_storage.state = ModelState.DESTROY
                    existing_storage.status = ModelStatus.READY
                else:
                    raise EntityWrongState(f"Storage cannot be destroyed, has wrong state {existing_storage.state}")

            case ModelActions.EXECUTE:
                await execute_entity(existing_storage)
                await self.event_sender.send_task(
                    existing_storage.id, requester=requester, trace_id=self.audit_log_handler.trace_id
                )

            case ModelActions.RECREATE:
                await recreate_entity(existing_storage, is_resource=False)

            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = StorageResponse.model_validate(existing_storage)
        await self.event_sender.send_event(response, body.action)
        return response

    async def delete(self, storage_id: str, requester: UserDTO) -> None:
        existing_storage = await self.crud.get_by_id(storage_id)
        if not existing_storage:
            raise EntityNotFound("Storage not found")

        await delete_entity(existing_storage)
        await self.audit_log_handler.create_log(storage_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(storage_id)
        await self.log_service.delete_by_entity_id(storage_id)
        await self.task_service.delete_by_entity_id(storage_id)
        await self.crud.delete(existing_storage)

    async def get_actions(self, storage_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the storage.
        :param storage_id: ID of the storage
        :return: List of actions
        """
        requester_permissions = await user_entity_permissions(requester, storage_id)
        if "write" not in requester_permissions and "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        storage = await self.crud.get_by_id(storage_id)
        if not storage:
            raise EntityNotFound("Source Code not found")

        if storage.status in [ModelStatus.IN_PROGRESS]:
            return []

        user_is_admin = "admin" in requester_permissions

        if storage.status == ModelStatus.QUEUED:
            if user_is_admin:
                actions.append(ModelActions.RETRY)
            return actions

        if storage.state == ModelState.PROVISIONED:
            actions.append(ModelActions.DESTROY)
            actions.append(ModelActions.EXECUTE)
            actions.append(ModelActions.EDIT)

        elif storage.state == ModelState.PROVISION:
            actions.append(ModelActions.EXECUTE)
            actions.append(ModelActions.EDIT)
            if storage.status == ModelStatus.READY:
                actions.append(ModelActions.DELETE)
        elif storage.state == ModelState.DESTROYED:
            if storage.status == ModelStatus.DONE:
                actions.append(ModelActions.RECREATE)
                if user_is_admin:
                    actions.append(ModelActions.DELETE)

        elif storage.state == ModelState.DESTROY:
            if storage.status == ModelStatus.ERROR or storage.status == ModelStatus.READY:
                actions.append(ModelActions.RECREATE)
                actions.append(ModelActions.EXECUTE)

        return actions
