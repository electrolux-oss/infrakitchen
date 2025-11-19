import logging
from collections import defaultdict
from collections.abc import Sequence
from typing import Any, Literal
from uuid import UUID

from application.resources.functions import (
    add_resource_parent_policy,
    get_resource_variable_schema,
    validate_resource_variables_on_create,
    validate_resource_variables_on_patch,
)
from application.resources.model import Resource, ResourceDTO
from application.source_code_versions.service import SourceCodeVersionService
from application.storages.service import StorageService
from application.templates.schema import TemplateResponse
from application.templates.service import TemplateService
from core.adapters.cloud_resource_adapter import CloudResourceAdapter
from core.adapters.provider_adapters import IntegrationProvider
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.caches.functions import cache_decorator
from core.config import InfrakitchenConfig
from core.constants import ModelStatus, ModelState
from core.constants.model import ModelActions
from core.database import to_dict
from core.errors import DependencyError, EntityNotFound, EntityWrongState
from core.logs.service import LogService
from core.permissions.service import PermissionService
from application.resource_temp_state.handler import ResourceTempStateHandler
from core.revisions.handler import RevisionHandler
from core.tasks.service import TaskEntityService
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO
from core.utils.entity_state_handler import (
    delete_entity,
    destroy_entity,
    execute_entity,
    recreate_entity,
    reject_entity,
    approve_entity,
)
from core.utils.event_sender import EventSender
from core.utils.model_tools import is_valid_uuid
from .crud import ResourceCRUD
from .schema import (
    ResourceCreate,
    ResourceResponse,
    ResourceShort,
    ResourceTreeResponse,
    ResourceVariableSchema,
    ResourceWithConfigs,
    ResourcePatch,
)
from ..integrations.crud import IntegrationCRUD

logger = logging.getLogger(__name__)


class ResourceService:
    """
    ResourceService implements all required business-logic. It uses additional services and utils as helpers
    e.g. ResourceCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: ResourceCRUD,
        template_service: TemplateService,
        crud_integration: IntegrationCRUD,
        permission_service: PermissionService,
        service_source_code_version: SourceCodeVersionService,
        storage_service: StorageService,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        workspace_event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        resource_temp_state_handler: ResourceTempStateHandler,
        log_service: LogService,
        task_service: TaskEntityService,
    ):
        self.crud: ResourceCRUD = crud
        self.template_service: TemplateService = template_service
        self.crud_integration: IntegrationCRUD = crud_integration
        self.permission_service: PermissionService = permission_service
        self.service_source_code_version: SourceCodeVersionService = service_source_code_version
        self.storage_service: StorageService = storage_service
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.workspace_event_sender: EventSender = workspace_event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.resource_temp_state_handler: ResourceTempStateHandler = resource_temp_state_handler
        self.log_service: LogService = log_service
        self.task_service: TaskEntityService = task_service

    async def get_dto_by_id(self, resource_id: str | UUID) -> ResourceDTO | None:
        if not is_valid_uuid(resource_id):
            raise ValueError(f"Invalid resource ID: {resource_id}")

        resource = await self.crud.get_by_id(resource_id)
        if resource is None:
            return None
        return ResourceDTO.model_validate(resource)

    async def get_by_id(self, resource_id: str | UUID) -> ResourceResponse | None:
        if not is_valid_uuid(resource_id):
            raise ValueError(f"Invalid resource ID: {resource_id}")

        resource = await self.crud.get_by_id(resource_id)
        if resource is None:
            return None
        return ResourceResponse.model_validate(resource)

    async def get_all(self, **kwargs) -> list[ResourceResponse]:
        resources = await self.crud.get_all(**kwargs)
        return [ResourceResponse.model_validate(resource) for resource in resources]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(
        self,
        resource: ResourceCreate,
        requester: UserDTO,
        allowed_parent_states: list[Any] | None = None,
    ) -> ResourceResponse:
        """
        Create a new resource.
        :param resource: ResourceCreate to create
        :param requester: User who creates the resource
        :return: Created resource
        """

        if allowed_parent_states is None:
            allowed_parent_states = [ModelState.PROVISIONED]

        body = resource.model_dump(exclude_unset=True)

        template = await self.template_service.get_by_id(resource.template_id)
        if template is None:
            raise EntityNotFound("Template not found")

        if template.status != ModelStatus.ENABLED:
            raise EntityWrongState("Template is not enabled")

        parent_resources = await self.crud.get_all(filter={"id": resource.parents})
        if len(template.parents) != len(parent_resources):
            raise ValueError("Invalid parent templates")

        parent_integrations = [parent.integration_ids for parent in parent_resources if parent.integration_ids]

        if parent_integrations and not resource.integration_ids:
            raise ValueError("Parent has defined integration. Integration ID is required")

        # TODO: Check if parent template is required
        for parent in parent_resources:
            if parent.state not in allowed_parent_states:
                raise EntityWrongState(f"Parent resource {parent.template} ID: {parent.id} has {parent.state} state.")

        if template.abstract is True:
            body["abstract"] = True
        else:
            # validate configuration variables
            if resource.source_code_version_id:
                source_code_version_id = resource.source_code_version_id
                source_code_version = await self.service_source_code_version.get_by_id(source_code_version_id)
                if source_code_version is None:
                    raise EntityNotFound("Source code version not found")
                if source_code_version.template.id != resource.template_id:
                    raise ValueError(
                        "Source code version template ID does not match resource template ID. "
                        f"Expected {source_code_version.template.id}, got {resource.template_id}"
                    )

                if source_code_version.status == ModelStatus.DISABLED:
                    raise EntityWrongState("Source code version is disabled")

                resource_varibles_schema = await self.get_variable_schema(
                    source_code_version_id=source_code_version_id,
                    resource_ids=resource.parents,
                )
                # Validate that all variables are present in the request and have correct types
                unique_variables = [v for v in resource_varibles_schema if v.unique]
                templates_resources: list[ResourceResponse]
                if unique_variables:
                    templates_resources = await self.get_all(
                        filter={
                            "template_id": resource.template_id,
                            # TODO: filter by variables to decrease load
                            # "variables": [v.name for v in unique_variables],
                        }
                    )
                else:
                    templates_resources = []

                await validate_resource_variables_on_create(
                    schema=resource_varibles_schema, resource=resource, templates_resources=templates_resources
                )
            else:
                # if template is not abstract, source_code_version_id is required
                raise ValueError("Source code version ID is required for non-abstract templates")

            # validate that storage_id is valid
            if resource.storage_id and source_code_version.source_code.source_code_language in ["opentofu"]:
                storage = await self.storage_service.get_by_id(str(resource.storage_id))
                if not storage:
                    raise EntityNotFound("Storage not found")
                if resource.storage_path is None or resource.storage_path == "":
                    raise ValueError("Storage path is required for non-abstract resources with storage")

        body["created_by"] = requester.id
        new_resource = await self.crud.create(body)
        new_resource.state = ModelState.PROVISION

        if InfrakitchenConfig().approval_flow is True:
            new_resource.status = ModelStatus.APPROVAL_PENDING
        else:
            new_resource.status = ModelStatus.READY

        result = await self.crud.get_by_id(new_resource.id)

        await self.revision_handler.handle_revision(new_resource)
        await self.audit_log_handler.create_log(new_resource.id, requester.id, ModelActions.CREATE)
        response = ResourceResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        await add_resource_parent_policy(
            resource_id=new_resource.id,
            parent_ids=[p.id for p in new_resource.parents],
            casbin_enforcer=self.permission_service.casbin_enforcer,
        )

        if response.workspace is not None:
            await self.workspace_event_sender.send_task(response.id, requester=requester, action=ModelActions.CREATE)

        return response

    async def patch(self, resource_id: str, resource: ResourcePatch, requester: UserDTO) -> ResourceResponse:
        """
        Update an existing resource.
        :param resource_id: ID of the resource to update
        :param resource: Resource to update
        :param requester: User who updates the resource
        :return: Updated resource
        """
        body = resource.model_dump(exclude_unset=True)
        existing_resource = await self.crud.get_by_id(resource_id)

        if not existing_resource:
            raise EntityNotFound("Resource not found")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_resource)

        if existing_resource.status in [ModelStatus.DISABLED, ModelStatus.QUEUED, ModelStatus.IN_PROGRESS]:
            raise ValueError(f"Entity cannot be updated, has wrong status {existing_resource.status}")

        if existing_resource.state in [ModelState.DESTROY, ModelState.DESTROYED]:
            raise ValueError(f"Entity cannot be updated, has wrong state {existing_resource.state}")

        existing_resource_pydantic = ResourceResponse.model_validate(existing_resource)

        if existing_resource_pydantic.abstract is False:
            # validate configuration variables
            if resource.source_code_version_id:
                source_code_version_id = resource.source_code_version_id
                source_code_version = await self.service_source_code_version.get_by_id(str(source_code_version_id))
                if source_code_version is None:
                    raise ValueError("Invalid source_code version ID")

                if source_code_version.template.id != existing_resource.template_id:
                    raise ValueError(
                        "Source code version template ID does not match resource template ID. "
                        f"Expected {source_code_version.template.id}, got {existing_resource.template_id}"
                    )

                resource_variables_schema = await self.get_variable_schema(
                    source_code_version_id=source_code_version.id,
                    resource_ids=[p.id for p in existing_resource_pydantic.parents],
                )

                await validate_resource_variables_on_patch(
                    schema=resource_variables_schema,
                    resource=existing_resource_pydantic,
                    patched_resource=resource,
                )

        if (
            existing_resource_pydantic.status == ModelStatus.APPROVAL_PENDING
            and existing_resource_pydantic.state == ModelState.PROVISION
            and body is not None
        ):
            await self.crud.update(existing_resource, body)
            existing_resource = await self.crud.get_by_id(existing_resource.id)
            if not existing_resource:
                raise EntityNotFound("Resource not found after update")

        elif body is not None:
            await self.resource_temp_state_handler.set_resource_temp_state(
                resource_id=existing_resource.id, value=body, created_by=requester.id
            )

        response = ResourceResponse.model_validate(existing_resource)
        await self.event_sender.send_event(response, ModelActions.UPDATE)

        if existing_resource.workspace_id is not None:
            await self.workspace_event_sender.send_task(
                existing_resource.id, requester=requester, action=ModelActions.UPDATE
            )

        return response

    async def action_reject(
        self, existing_resource: Resource, pydantic_resource: ResourceDTO, requester: UserDTO
    ) -> None:
        resource_temp_state = await self.resource_temp_state_handler.get_by_resource_id(
            resource_id=pydantic_resource.id
        )

        if resource_temp_state is not None and pydantic_resource.state in [
            ModelState.PROVISIONED,
            ModelState.PROVISION,
        ]:
            if pydantic_resource.status not in [ModelStatus.DONE, ModelStatus.READY, ModelStatus.ERROR]:
                raise ValueError(f"Cannot reject changes for a resource in {pydantic_resource.status} status")

            await self.resource_temp_state_handler.delete_by_resource_id(resource_id=pydantic_resource.id)

        elif pydantic_resource.status == ModelStatus.APPROVAL_PENDING and pydantic_resource.state == ModelState.DESTROY:
            await reject_entity(existing_resource)

        elif (
            pydantic_resource.status == ModelStatus.APPROVAL_PENDING and pydantic_resource.state == ModelState.PROVISION
        ):
            await reject_entity(existing_resource)

            if resource_temp_state is not None:
                await self.resource_temp_state_handler.delete_by_resource_id(resource_id=pydantic_resource.id)

        else:
            raise ValueError(
                f"Resource has wrong state for rejection {pydantic_resource.status} {pydantic_resource.state}"
            )

        if pydantic_resource.workspace_id is not None:
            await self.workspace_event_sender.send_task(
                pydantic_resource.id, requester=requester, action=ModelActions.REJECT
            )

    async def action_approve(self, existing_resource: Resource, pydantic_resource: ResourceDTO, requester: UserDTO):
        resource_temp_state = await self.resource_temp_state_handler.get_by_resource_id(
            resource_id=pydantic_resource.id
        )

        if (
            pydantic_resource.status == ModelStatus.APPROVAL_PENDING
            and pydantic_resource.state == ModelState.PROVISION
            and resource_temp_state is None
        ):
            # APPROVAL_PENDING state can be only for new resource without temp state,
            # for existing resource will be craeted temp state
            await approve_entity(existing_resource, abstract=existing_resource.abstract)

        elif (
            pydantic_resource.status in [ModelStatus.READY, ModelStatus.ERROR]
            and pydantic_resource.state == ModelState.PROVISION
            and resource_temp_state is not None
        ):
            # when resource edited after creation and first approval
            await self.audit_log_handler.create_log(
                pydantic_resource.id, resource_temp_state.created_by, ModelActions.UPDATE
            )
            existing_resource = await self.crud.update(existing_resource, resource_temp_state.value)
            await self.revision_handler.handle_revision(existing_resource)
            await self.resource_temp_state_handler.delete_by_resource_id(resource_id=pydantic_resource.id)
            await self.crud.refresh(existing_resource)

        elif resource_temp_state is not None and pydantic_resource.state == ModelState.PROVISIONED:
            await approve_entity(existing_resource, abstract=existing_resource.abstract)
            await self.audit_log_handler.create_log(
                pydantic_resource.id, resource_temp_state.created_by, ModelActions.UPDATE
            )
            existing_resource = await self.crud.update(existing_resource, resource_temp_state.value)
            await self.revision_handler.handle_revision(existing_resource)
            await self.resource_temp_state_handler.delete_by_resource_id(resource_id=pydantic_resource.id)
            await self.crud.refresh(existing_resource)

        elif pydantic_resource.state == ModelState.DESTROY and pydantic_resource.status == ModelStatus.APPROVAL_PENDING:
            await approve_entity(existing_resource, abstract=existing_resource.abstract)

        else:
            raise ValueError(
                f"""Resource has wrong state for approval"
                    {pydantic_resource.status} Temp state ID: {resource_temp_state.id if resource_temp_state else None}
                """
            )

        if pydantic_resource.workspace_id is not None:
            await self.workspace_event_sender.send_task(
                pydantic_resource.id, requester=requester, action=ModelActions.APPROVE
            )

    async def action_destroy(self, existing_resource: Resource, pydantic_resource: ResourceDTO, requester: UserDTO):
        if pydantic_resource.state in [ModelState.DESTROY, ModelState.DESTROYED]:
            raise ValueError(f"Resource is already in {pydantic_resource.state} state")

        if pydantic_resource.status not in [ModelStatus.DONE, ModelStatus.READY, ModelStatus.ERROR]:
            raise ValueError(f"Cannot destroy a resource in {pydantic_resource.status} status")

        resource_temp_state = await self.resource_temp_state_handler.get_by_resource_id(
            resource_id=pydantic_resource.id
        )

        if resource_temp_state is not None:
            raise ValueError("Cannot delete a resource with hanging updates. Please approve or reject the changes")

        dependencies = existing_resource.children
        if dependencies:
            dependencies_in_wrong_state = []
            for child in dependencies:
                if not (child.state == ModelState.DESTROYED and child.status == ModelStatus.DONE):
                    dependencies_in_wrong_state.append(ResourceShort.model_validate(child).model_dump())

            if dependencies_in_wrong_state:
                raise DependencyError(
                    message="Cannot delete a resource with children that have not been destroyed or finalized",
                    metadata=dependencies_in_wrong_state,
                )

        await destroy_entity(existing_resource)

        if pydantic_resource.workspace_id is not None:
            await self.workspace_event_sender.send_task(
                pydantic_resource.id, requester=requester, action=ModelActions.DESTROY
            )

    async def action_recreate(self, existing_resource: Resource, requester: UserDTO):
        await recreate_entity(existing_resource)
        if existing_resource.parents:
            parents_in_wrong_state = []
            for parent in existing_resource.parents:
                if parent.state != ModelState.PROVISIONED:
                    parents_in_wrong_state.append(ResourceShort.model_validate(parent).model_dump())
            if parents_in_wrong_state:
                raise DependencyError(
                    "Parent resource has wrong state.",
                    metadata=parents_in_wrong_state,
                )

        if existing_resource.workspace_id is not None:
            await self.workspace_event_sender.send_task(
                existing_resource.id, requester=requester, action=ModelActions.RECREATE
            )

    async def patch_action(self, resource_id, body: PatchBodyModel, requester: UserDTO) -> ResourceResponse:
        """
        Patch an existing resource.
        :param resource_id: ID of the resource to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the resource
        :return: Patched resource
        """
        existing_resource = await self.crud.get_by_id(resource_id)
        if not existing_resource:
            raise EntityNotFound("Resource not found")

        # wrap existing_resource to pydantic model to avoid sqlalchemy object state issues
        pydantic_resource = ResourceDTO.model_validate(existing_resource)

        await self.audit_log_handler.create_log(pydantic_resource.id, requester.id, body.action)

        match body.action:
            case ModelActions.REJECT:
                await self.action_reject(existing_resource, pydantic_resource, requester)

            case ModelActions.RETRY:
                if existing_resource.status == ModelStatus.QUEUED:
                    await self.event_sender.send_task(
                        existing_resource.id,
                        requester=requester,
                        trace_id=self.audit_log_handler.trace_id,
                        action=ModelActions.EXECUTE,
                    )
                else:
                    raise EntityWrongState("Only resources in QUEUED status can be retried")

            case ModelActions.APPROVE:
                # Apply temp state changes to existing_resource if values differ
                await self.action_approve(existing_resource, pydantic_resource, requester)

            case ModelActions.DESTROY:
                await self.action_destroy(existing_resource, pydantic_resource, requester)
            case ModelActions.EXECUTE:
                await execute_entity(existing_resource)
                await self.event_sender.send_task(
                    pydantic_resource.id, requester=requester, trace_id=self.audit_log_handler.trace_id
                )
            case ModelActions.DRYRUN:
                if existing_resource.status not in [
                    ModelStatus.READY,
                    ModelStatus.ERROR,
                    ModelStatus.APPROVAL_PENDING,
                    ModelStatus.DONE,
                ]:
                    raise EntityWrongState(
                        "Dry run is only allowed for resources in READY, ERROR, APPROVAL_PENDING, or DONE",
                    )
                await self.event_sender.send_task(
                    existing_resource.id,
                    requester=requester,
                    action=ModelActions.DRYRUN,
                    trace_id=self.audit_log_handler.trace_id,
                )
            case ModelActions.DRYRUN_WITH_TEMP_STATE:
                resource_temp_state = await self.resource_temp_state_handler.get_by_resource_id(
                    resource_id=pydantic_resource.id
                )
                if resource_temp_state is None:
                    raise ValueError("Resource has no temporary state for dry run with temp state")

                if existing_resource.status not in [
                    ModelStatus.READY,
                    ModelStatus.ERROR,
                    ModelStatus.APPROVAL_PENDING,
                    ModelStatus.DONE,
                ]:
                    raise EntityWrongState(
                        "Dry run is only allowed for resources in READY, ERROR, APPROVAL_PENDING, or DONE",
                    )

                await self.event_sender.send_task(
                    existing_resource.id,
                    requester=requester,
                    action=ModelActions.DRYRUN_WITH_TEMP_STATE,
                    trace_id=self.audit_log_handler.trace_id,
                )
            case ModelActions.RECREATE:
                await self.action_recreate(existing_resource, requester)

            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = ResourceResponse.model_validate(existing_resource)
        await self.event_sender.send_event(response, body.action)
        return response

    async def delete(self, resource_id: str, requester: UserDTO) -> None:
        existing_resource = await self.crud.get_by_id(resource_id)
        if not existing_resource:
            raise EntityNotFound("Resource not found")

        resource_temp_state = await self.resource_temp_state_handler.get_by_resource_id(
            resource_id=existing_resource.id
        )
        if resource_temp_state is not None:
            await self.resource_temp_state_handler.delete_by_resource_id(resource_id=existing_resource.id)

        await delete_entity(existing_resource)
        await self.audit_log_handler.create_log(resource_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(resource_id)
        await self.log_service.delete_by_entity_id(resource_id)
        await self.task_service.delete_by_entity_id(resource_id)
        await self.crud.delete(existing_resource)

    async def get_tree(
        self, resource_id: str, direction: Literal["parents", "children"] = "children"
    ) -> ResourceTreeResponse | None:
        """
        Get the tree of resources for a given resource ID.
        :param resource_id: ID of the resource
        :param direction: Direction of the tree traversal ("parents" or "children")
        :return: ResourceTreeResponse object representing the tree
        """
        if direction == "parents":
            tree = await self.crud.get_tree_to_parent(resource_id)
        else:
            tree = await self.crud.get_tree_to_children(resource_id)
        if not tree:
            raise EntityNotFound("Resource not found")

        root = None
        node_map = {}
        children_map = defaultdict(list)
        # First pass: wrap raw dicts into Pydantic nodes and map by ID
        for raw_node in tree:
            node = ResourceTreeResponse(
                id=raw_node["id"],
                name=raw_node["name"],
                state=raw_node["state"],
                status=raw_node["status"],
                template_name=raw_node["template_name"],
                children=[],
            )
            node_map[node.id] = node
            parent_id: str | None = None
            if direction == "parents":
                parent_id = raw_node["parent_id"]
            else:
                parent_id = raw_node["child_id"]

            if parent_id is None:
                root = node
            else:
                children_map[parent_id].append(node)

        # Second pass: assign children to parents
        for parent_id, children in children_map.items():
            if parent_id in node_map:
                node_map[parent_id].children.extend(children)

        if root is None:
            return None
        return root

    async def get_parent_ids(self, resource_id: str | UUID) -> list[UUID]:
        """
        Get all parent IDs for a resource.
        :param resource_id: ID of the resource
        :return: List of parent IDs
        """
        parents = await self.crud.get_parent_ids(resource_id)
        if not parents:
            raise EntityNotFound("Resource not found")
        return parents

    async def get_parents_with_configs(self, resource_id: str | UUID) -> list[ResourceWithConfigs]:
        """
        Get all parent resources with their configurations.
        :param resource_id: ID of the resource
        :return: List of ResourceWithConfigs objects
        """
        parent_ids = await self.get_parent_ids(resource_id)
        if not parent_ids:
            return []
        parents = await self.crud.get_parents_with_configs(resource_ids=parent_ids)
        return [ResourceWithConfigs.model_validate(parent) for parent in parents]

    async def get_variable_schema(
        self, source_code_version_id: str | UUID, resource_ids: Sequence[str | UUID]
    ) -> list[ResourceVariableSchema]:
        """
        Get the variable schema for a resource.
        :param resource_id: ID of the resource
        :param source_code_version_id: ID of the source code version
        :return: Dictionary representing the variable schema
        """
        resource_scv = await self.service_source_code_version.get_by_id_with_configs(source_code_version_id)
        if not resource_scv:
            raise EntityNotFound("Source code version not found")

        if len(resource_ids) == 0:
            schema = get_resource_variable_schema(resource_scv, [], [])
            return schema

        parents: list[ResourceWithConfigs] = []
        for resource_id in resource_ids:
            if not is_valid_uuid(resource_id):
                raise ValueError(f"Invalid resource ID: {resource_id}")
            resource = await self.crud.get_by_id(resource_id)
            if not resource:
                raise EntityNotFound(f"Resource {resource_id} not found")

            # Get all parents of parents with assigned variables and outputs
            parents += await self.get_parents_with_configs(resource_id)

        # Fetch all source code versions with configs and outputs for generating the schema
        # We do filter out the source code version ID of the current resource, since resource can be abstract
        # and don't have any configs or outputs
        parent_source_code_version_ids: list[str] = []
        for parent in parents:
            if parent.source_code_version_id:
                parent_source_code_version_ids.append(str(parent.source_code_version_id))

        parent_scvs = await self.service_source_code_version.get_scvs_with_configs_and_outputs(
            source_code_version_ids=parent_source_code_version_ids
        )
        schema = get_resource_variable_schema(resource_scv, parents, parent_scvs)
        return sorted(schema, key=lambda item: item.index)

    async def get_actions(self, resource_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the resource.
        :param resource_id: ID of the resource
        :return: List of actions
        """
        requester_permissions = await user_entity_permissions(requester, resource_id)
        if "write" not in requester_permissions and "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        resource = await self.crud.get_by_id(resource_id)
        if not resource:
            raise EntityNotFound("Resource not found")

        if resource.status in [ModelStatus.IN_PROGRESS]:
            return []

        user_is_admin = "admin" in requester_permissions

        if resource.status == ModelStatus.QUEUED:
            if user_is_admin:
                actions.append(ModelActions.RETRY)
            return actions

        resource_temp_state = await self.resource_temp_state_handler.get_by_resource_id(resource.id)

        if resource_temp_state:
            actions.append("has_temporary_state")

        if resource.status == ModelStatus.APPROVAL_PENDING:
            if user_is_admin:
                actions.append(ModelActions.APPROVE)
            actions.append(ModelActions.DRYRUN)
            actions.append(ModelActions.DOWNLOAD)
            actions.append(ModelActions.EDIT)
            if resource.state == ModelState.PROVISION:
                actions.append(ModelActions.DELETE)
        elif resource.status == ModelStatus.REJECTED:
            actions.append(ModelActions.RECREATE)
            if user_is_admin:
                actions.append(ModelActions.DELETE)
        elif resource.state == ModelState.PROVISIONED:
            actions.append(ModelActions.DESTROY)
            actions.append(ModelActions.EXECUTE)
            actions.append(ModelActions.DOWNLOAD)
            actions.append(ModelActions.EDIT)
            actions.append(ModelActions.DRYRUN)

            if resource_temp_state is not None and user_is_admin:
                actions.append(ModelActions.APPROVE)
        elif resource.state == ModelState.PROVISION:
            actions.append(ModelActions.EXECUTE)
            actions.append(ModelActions.DOWNLOAD)
            actions.append(ModelActions.EDIT)
            if resource.status == ModelStatus.READY:
                actions.append(ModelActions.DRYRUN)
                actions.append(ModelActions.DELETE)
            if resource_temp_state is not None and user_is_admin:
                actions.append(ModelActions.APPROVE)
        elif resource.state == ModelState.DESTROYED:
            if resource.status == ModelStatus.DONE:
                actions.append(ModelActions.RECREATE)
                if user_is_admin:
                    actions.append(ModelActions.DELETE)
        elif resource.state == ModelState.DESTROY:
            if resource.status == ModelStatus.ERROR or resource.status == ModelStatus.READY:
                actions.append(ModelActions.RECREATE)
                actions.append(ModelActions.DOWNLOAD)
                actions.append(ModelActions.EXECUTE)
                actions.append(ModelActions.DRYRUN)

        return actions

    @cache_decorator(avoid_args=True, ttl=300)  # Cache for 5 minutes
    async def metadata(self, resource_id: str) -> dict[str, Any]:
        """
        Get cloud metadata for a resource.

        Args:
            resource_id (str): The ID of the resource.

        Returns:
            dict[str, Any]: The cloud metadata.
        """

        res = await self.crud.get_by_id(resource_id)

        if not res:
            raise EntityNotFound("Resource not found")

        resource = ResourceResponse.model_validate(res)
        variables: dict[str, Any] = dict()

        for variable in resource.variables:
            variables.update({variable.name: variable.value})

        resources_metadata: dict[str, Any] = dict()

        assert resource.integration_ids is not None, f"Resource with id {resource_id} has no integration_ids"

        comp = await self.template_service.get_by_id(resource.template.id)

        if not comp:
            raise EntityNotFound("Template not found")

        template = TemplateResponse.model_validate(comp)

        assert template.cloud_resource_types is not None, f"Template with id {template.id} has no cloud_resource_types"
        assert len(template.cloud_resource_types) > 0, f"Template with id {template.id} has no cloud_resource_types"

        integrations = await self.crud_integration.get_all(filter={"id": [str(i.id) for i in resource.integration_ids]})
        if not integrations:
            raise EntityNotFound("Integrations not found")

        for integration in integrations:
            if integration.integration_type == "cloud":
                if not CloudResourceAdapter.providers.get(integration.integration_provider):
                    continue  # skip if provider is not supported

                provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(
                    integration.integration_provider
                )
                if not provider_adapter:
                    raise NotImplementedError(f"Provider {integration.integration_provider} is not supported")

                provider_adapter_instance: IntegrationProvider = provider_adapter(
                    **{"configuration": integration.configuration}
                )
                await provider_adapter_instance.authenticate()

                cloud_resource: CloudResourceAdapter = CloudResourceAdapter.providers[integration.integration_provider](
                    provider_adapter_instance.environment_variables
                )

                for cr in template.cloud_resource_types:
                    try:
                        cloud_resources = await cloud_resource.metadata(resource_name=cr, **variables)
                    except Exception as e:
                        logger.error(f"Error while scanning resource {cr}: {e}")
                        continue

                    resources_metadata[cr] = cloud_resources

        return resources_metadata
