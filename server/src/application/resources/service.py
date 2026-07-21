import asyncio
import logging
from collections import defaultdict
from collections.abc import Sequence
from typing import Any, Literal
from uuid import UUID, uuid4

from application.integrations.service import IntegrationService
from core.notifications.controller import NotificationEvent, publish_notification_event
from core.notifications.model import Subscription
from core.notifications.service import SubscriptionService
from application.resources.functions import (
    add_resource_parent_policy,
    add_resource_parent_subscriptions,
    convert_field_by_naming_convention_pattern,
    delete_resource_policies,
    get_resource_actions,
    get_resource_variable_schema,
    validate_resource_variables_on_create,
    update_resource_variables_on_patch,
)
from application.resources.model import Resource, ResourceDTO
from application.source_code_versions.service import SourceCodeVersionService
from application.storages.service import StorageService
from application.templates.schema import TemplateResponse
from application.templates.service import TemplateService
from application.validation_rules.service import ValidationRuleService
from core.adapters.cloud_resource_adapter import CloudResourceAdapter
from core.adapters.provider_adapters import IntegrationProvider
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.caches.functions import cache_decorator
from core.config import InfrakitchenConfig
from core.constants import ModelStatus, ModelState
from core.constants.model import EventType, ModelActions
from core.database import FieldSpec, to_dict
from core.errors import AccessDenied, DependencyError, EntityExistsError, EntityNotFound, EntityWrongState
from core.logs.service import LogService
from core.permissions.model import Permission
from core.permissions.schema import EntityPolicyCreate
from core.permissions.service import PermissionService
from application.resource_temp_state.handler import ResourceTempStateHandler
from application.favorites.service import FavoriteService
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
from core.utils.model_tools import has_field_changes, is_valid_uuid, model_db_dump
from .crud import ResourceCRUD
from .schema import (
    ResourceCreate,
    ResourceResponse,
    ResourceShort,
    ResourceTreeResponse,
    ResourceVariableSchema,
    ResourceWithConfigs,
    ResourceUpdate,
)

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
        integration_service: IntegrationService,
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
        validation_rule_service: ValidationRuleService,
        favorite_service: FavoriteService,
        subscription_service: SubscriptionService,
    ):
        self.crud: ResourceCRUD = crud
        self.template_service: TemplateService = template_service
        self.integration_service: IntegrationService = integration_service
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
        self.validation_rule_service: ValidationRuleService = validation_rule_service
        self.favorite_service: FavoriteService = favorite_service
        self.subscription_service: SubscriptionService = subscription_service

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

    async def query_by_id(self, resource_id: str | UUID, fields: FieldSpec | None = None) -> Resource | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(resource_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Resource]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def get_actions(self, resource_id: str | UUID, requester: UserDTO) -> list[str]:
        resource = await self.crud.get_by_id(resource_id, fields={"status": None, "state": None})
        if not resource:
            raise EntityNotFound("Resource not found")
        resource_temp_state = await self.resource_temp_state_handler.get_by_resource_id(resource_id)
        return await get_resource_actions(
            requester, resource.id, resource.status, resource.state, resource_temp_state is not None
        )

    async def create_resource(
        self,
        resource: ResourceCreate,
        requester: UserDTO,
        allowed_parent_states: list[Any] | None = None,
    ) -> Resource:
        """
        Create a new resource.
        :param resource: ResourceCreate to create
        :param requester: User who creates the resource
        :return: ORM model of the created resource
        """

        if allowed_parent_states is None:
            allowed_parent_states = [ModelState.PROVISIONED]

        template = await self.template_service.get_by_id(resource.template_id)
        if template is None:
            raise EntityNotFound("Template not found")

        if template.status != ModelStatus.ENABLED:
            raise EntityWrongState("Template is not enabled")

        parent_resources = await self.crud.get_all(filter={"id": resource.parents})
        if len(template.parents) != len(parent_resources):
            raise ValueError("Invalid parent templates")

        # TODO: Check if parent template is required
        for parent in parent_resources:
            if parent.state not in allowed_parent_states:
                raise EntityWrongState(f"Parent resource {parent.template} ID: {parent.id} has {parent.state} state.")

        if template.abstract is False:
            # validate that integrations are allowed for the template and are enabled.
            # If parent has integration, child resource should have it too
            parent_integrations = [parent.integration_ids for parent in parent_resources if parent.integration_ids]

            if parent_integrations and not resource.integration_ids:
                raise ValueError("Parent has defined integration. Integration ID is required")

            if template.configuration.allowed_provider_integration_types and not resource.integration_ids:
                raise ValueError("Template requires integration. Integration ID is required")

            if resource.integration_ids:
                # require write access to every integration the user explicitly chose;
                # integrations inherited from a parent are exempt (read on the parent is enough)
                inherited_integration_ids: set[str] = set()
                for parent in parent_resources:
                    for parent_integration in parent.integration_ids or []:
                        inherited_integration_ids.add(str(parent_integration.id))
                for integration_id in resource.integration_ids:
                    if str(integration_id) in inherited_integration_ids:
                        continue
                    integration_permissions = await user_entity_permissions(requester, integration_id, "integration")
                    if "write" not in integration_permissions and "admin" not in integration_permissions:
                        raise AccessDenied(f"You don't have write access to integration {integration_id}")

                # if template allows only specific integration types,
                # check that number of integrations is equal to number of allowed types.
                if template.configuration.allowed_provider_integration_types:
                    if len(resource.integration_ids) != len(template.configuration.allowed_provider_integration_types):
                        raise ValueError(
                            f"Number of integrations must be equal to number of allowed integration "
                            "types for the template "
                            f"Expected {len(template.configuration.allowed_provider_integration_types)}, "
                            f"got {len(resource.integration_ids)}"
                        )

                integrations = await self.integration_service.get_all_dto(
                    filter={"id": [i for i in resource.integration_ids]}
                )
                for integration in integrations:
                    if integration.status != ModelStatus.ENABLED:
                        raise EntityWrongState(
                            f"Integration {integration.id} is not enabled and cannot be assigned to resource"
                        )

                    if (
                        template.configuration.allowed_provider_integration_types
                        and integration.integration_provider
                        not in template.configuration.allowed_provider_integration_types
                    ):
                        raise ValueError(
                            f"Integration {integration.id} has provider {integration.integration_provider} "
                            "which is not allowed for the template"
                        )

                # Validate template one_resource_per_integration configuration.
                if template.configuration.one_resource_per_integration and resource.integration_ids:
                    if integrations_to_check := [
                        integration
                        for integration in integrations
                        if integration.integration_provider in template.configuration.one_resource_per_integration
                    ]:
                        resources_with_integration = await self.crud.get_resource_by_template_and_integrations(
                            template_id=resource.template_id,
                            integration_ids=[integration.id for integration in integrations_to_check],
                        )

                        if resources_with_integration:
                            raise DependencyError(
                                message="Cannot create resource because integration(s) "
                                f"'{','.join([integration.name for integration in integrations_to_check])}' "
                                "are already used by other resource(s) for the same template.",
                                metadata=[
                                    ResourceShort.model_validate(res).model_dump() for res in resources_with_integration
                                ],
                            )

            # Validate required_configuration_variables
            if template.configuration.required_configuration_variables:
                provided_config_names = {dc.name for dc in resource.dependency_config}
                missing = [
                    name
                    for name in template.configuration.required_configuration_variables
                    if name not in provided_config_names
                ]
                if missing:
                    raise ValueError(f"Missing required dependency config variable(s): {', '.join(missing)}")

            # Validate if user has write permission to linked workspace
            if resource.workspace_id is not None:
                workspace_permissions = await user_entity_permissions(requester, resource.workspace_id, "workspace")
                if "write" not in workspace_permissions and "admin" not in workspace_permissions:
                    raise AccessDenied(f"You don't have write access to workspace {resource.workspace_id}")

            # validate configuration variables
            if source_code_version_id := resource.source_code_version_id:
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

                if source_code_version.status != ModelStatus.DONE:
                    raise EntityWrongState(
                        "Source code version is not in DONE state. You should sync it before using in resource"
                    )

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
            if source_code_version.source_code.source_code_language in ["opentofu"]:
                if resource.storage_id is None:
                    raise ValueError("Storage ID is required for Terraform and OpenTofu resources")

                storage = await self.storage_service.get_by_id(str(resource.storage_id))
                if not storage:
                    raise EntityNotFound("Storage not found")

                if storage.state != ModelState.PROVISIONED:
                    raise EntityWrongState("Storage is not provisioned")

                if resource.storage_path is None or resource.storage_path == "":
                    raise ValueError("Storage path is required for non-abstract resources with storage")

            if template.configuration.naming_convention:
                parents_lists: list[list[ResourceWithConfigs]] = await asyncio.gather(
                    *[self.get_parents_with_configs(rid) for rid in resource.parents]
                )
                parents: list[ResourceWithConfigs] = [p for sublist in parents_lists for p in sublist]

                await convert_field_by_naming_convention_pattern(
                    resource, fields=["name", "storage_path"], parents=parents
                )

        body = resource.model_dump(exclude_unset=True)
        if template.abstract is True:
            body["abstract"] = True

        body["created_by"] = requester.id
        new_resource = await self.crud.create(body)
        new_resource.state = ModelState.PROVISION

        if InfrakitchenConfig().approval_flow is True:
            new_resource.status = ModelStatus.APPROVAL_PENDING
        else:
            new_resource.status = ModelStatus.READY

        result = await self.crud.get_by_id(new_resource.id)
        if not result:
            raise EntityNotFound("Resource not found after creation")

        await self.revision_handler.handle_revision(new_resource)
        await self.audit_log_handler.create_log(
            new_resource.id, requester.id, ModelActions.CREATE, revision_number=new_resource.revision_number
        )
        response = ResourceResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        await add_resource_parent_policy(
            resource_id=new_resource.id,
            parent_ids=[p.id for p in new_resource.parents],
            permission_service=self.permission_service,
            requester=requester,
        )
        await add_resource_parent_subscriptions(
            resource_id=new_resource.id,
            parent_ids=[p.id for p in new_resource.parents],
            subscription_service=self.subscription_service,
            requester=requester,
        )

        if response.workspace is not None:
            await self.workspace_event_sender.send_task(
                response.id,
                requester=requester,
                action=ModelActions.CREATE,
                audit_log_id=self.audit_log_handler.audit_log_id,
                trace_id=self.audit_log_handler.trace_id,
            )

        await self.permission_service.casbin_enforcer.send_reload_event()
        return result

    async def create(
        self,
        resource: ResourceCreate,
        requester: UserDTO,
        allowed_parent_states: list[Any] | None = None,
    ) -> ResourceResponse:
        result = await self.create_resource(
            resource=resource, requester=requester, allowed_parent_states=allowed_parent_states
        )
        return ResourceResponse.model_validate(result)

    async def update_resource(self, resource_id: str, resource: ResourceUpdate, requester: UserDTO) -> Resource:
        """
        Update an existing resource.
        :param resource_id: ID of the resource to update
        :param resource: Resource to update
        :param requester: User who updates the resource
        :return: ORM model of the updated resource
        """

        def check_critical_fields_changed(existing: Resource, patched: ResourceUpdate) -> bool:
            critical_fields = ["storage_id", "storage_path"]
            for field in critical_fields:
                if getattr(patched, field) is not None and getattr(patched, field) != getattr(existing, field):
                    return True
            return False

        body = model_db_dump(
            resource,
            exclude_unset=True,
            exclude_defaults=True,
        )

        if not body:
            raise ValueError("At least one field must be provided in Resource update.")

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
            if check_critical_fields_changed(existing_resource, resource):
                requester_permissions = await user_entity_permissions(requester, resource_id, "resource")
                if "admin" not in requester_permissions:
                    raise ValueError("Only admin can change storage or storage path of the resource")

                if (
                    existing_resource.source_code_version
                    and existing_resource.source_code_version.source_code.source_code_language in ["opentofu"]
                ):
                    storage_id = resource.storage_id or existing_resource.storage_id
                    storage = await self.storage_service.get_by_id(str(storage_id))
                    if not storage:
                        raise EntityNotFound("Storage not found")

                    if storage.state != ModelState.PROVISIONED:
                        raise EntityWrongState("Storage is not provisioned")

            # validate configuration variables
            if resource.source_code_version_id:
                source_code_version_id = resource.source_code_version_id
                source_code_version = await self.service_source_code_version.get_by_id(source_code_version_id)
                if source_code_version is None:
                    raise ValueError("Invalid source_code version ID")

                if source_code_version.template.id != existing_resource.template_id:
                    raise ValueError(
                        "Source code version template ID does not match resource template ID. "
                        f"Expected {source_code_version.template.id}, got {existing_resource.template_id}"
                    )

                if source_code_version.status != ModelStatus.DONE:
                    raise EntityWrongState(
                        "Source code version is not in DONE state. You should sync it before using in resource"
                    )

                # When source_code_version_id changes without explicit variables,
                # carry over the existing resource's variables so they can be
                # validated/merged against the new schema automatically.
                if "variables" not in resource.model_fields_set:
                    resource.variables = existing_resource_pydantic.variables

                resource_variables_schema = await self.get_variable_schema(
                    source_code_version_id=source_code_version.id,
                    resource_ids=[p.id for p in existing_resource_pydantic.parents],
                )

                await update_resource_variables_on_patch(
                    schema=resource_variables_schema,
                    resource=existing_resource_pydantic,
                    patched_resource=resource,
                    allow_frozen_variable_changes=existing_resource.state == ModelState.PROVISION,
                )

            # validate that integrations are allowed for the template and are enabled
            if resource.integration_ids is not None:
                # require write access for any integration newly added by this patch;
                # exempt integrations already on the resource and integrations inherited from parents
                exempt_integration_ids: set[str] = {
                    str(i.id) for i in (existing_resource_pydantic.integration_ids or [])
                }
                for parent in existing_resource.parents or []:
                    for parent_integration in parent.integration_ids or []:
                        exempt_integration_ids.add(str(parent_integration.id))
                for integration_id in resource.integration_ids:
                    if str(integration_id) in exempt_integration_ids:
                        continue
                    integration_permissions = await user_entity_permissions(requester, integration_id, "integration")
                    if "write" not in integration_permissions and "admin" not in integration_permissions:
                        raise AccessDenied(f"You don't have write access to integration {integration_id}")

                if template := await self.template_service.get_by_id(existing_resource_pydantic.template.id):
                    if template.configuration.allowed_provider_integration_types:
                        if len(resource.integration_ids) != len(
                            template.configuration.allowed_provider_integration_types
                        ):
                            raise ValueError(
                                f"Number of integrations must be equal to number of allowed integration "
                                "types for the template "
                                f"Expected {len(template.configuration.allowed_provider_integration_types)}, "
                                f"got {len(resource.integration_ids)}"
                            )

                    integrations = await self.integration_service.get_all_dto(
                        filter={"id": [i for i in resource.integration_ids]}
                    )
                    for integration in integrations:
                        if integration.status != ModelStatus.ENABLED:
                            raise EntityWrongState(
                                f"Integration {integration.id} is not enabled and cannot be assigned to resource"
                            )

                        if (
                            template.configuration.allowed_provider_integration_types
                            and integration.integration_provider
                            not in template.configuration.allowed_provider_integration_types
                        ):
                            raise ValueError(
                                f"Integration {integration.id} has provider {integration.integration_provider} "
                                "which is not allowed for the template"
                            )

                else:
                    raise EntityNotFound("Template not found")

            if (
                "workspace_id" in resource.model_fields_set
                and resource.workspace_id is not None
                and str(resource.workspace_id) != str(existing_resource.workspace_id or "")
            ):
                workspace_permissions = await user_entity_permissions(requester, resource.workspace_id, "workspace")
                if "write" not in workspace_permissions and "admin" not in workspace_permissions:
                    raise AccessDenied(f"You don't have write access to workspace {resource.workspace_id}")

        if not has_field_changes(body, existing_resource):
            raise ValueError("No changes detected; the resource is already up to date.")

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

        response_pydantic = ResourceResponse.model_validate(existing_resource)
        await self.event_sender.send_event(response_pydantic, ModelActions.UPDATE)
        await self.publish_notification_event(existing_resource, ModelActions.UPDATE, status="info")

        if existing_resource.workspace_id is not None:
            await self.workspace_event_sender.send_task(
                existing_resource.id, requester=requester, action=ModelActions.UPDATE
            )

        return existing_resource

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
        def resource_variables_differ() -> bool:
            # compare variables in temp state and existing resource, if they differ, we need to change resource status
            if resource_temp_state is None:
                return False

            input_variables = resource_temp_state.value.get("variables", [])
            if not input_variables:
                return False

            existing_variables = pydantic_resource.variables or []
            if len(input_variables) != len(existing_variables):
                return True
            input_map = {v["name"]: v for v in input_variables}
            existing_map = {v.name: v.model_dump() for v in existing_variables}

            return input_map != existing_map

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
                pydantic_resource.id,
                resource_temp_state.created_by,
                ModelActions.UPDATE,
                revision_number=pydantic_resource.revision_number,
            )
            existing_resource = await self.crud.update(existing_resource, resource_temp_state.value)
            await self.revision_handler.handle_revision(existing_resource)
            if resource_variables_differ():
                await approve_entity(existing_resource, abstract=existing_resource.abstract)
            await self.resource_temp_state_handler.delete_by_resource_id(resource_id=pydantic_resource.id)
            await self.crud.refresh(existing_resource)

        elif resource_temp_state is not None and pydantic_resource.state == ModelState.PROVISIONED:
            if resource_variables_differ():
                await approve_entity(existing_resource, abstract=existing_resource.abstract)
            await self.audit_log_handler.create_log(
                pydantic_resource.id,
                resource_temp_state.created_by,
                ModelActions.UPDATE,
                revision_number=pydantic_resource.revision_number,
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
            if resource_variables_differ():
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

    async def patch_action_resource(
        self, resource_id: str | UUID, body: PatchBodyModel, requester: UserDTO, trace_id: str | None = None
    ) -> Resource:
        """
        Patch an existing resource.
        :param resource_id: ID of the resource to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the resource
        :return: ORM model of the patched resource
        """
        existing_resource = await self.crud.get_by_id(resource_id)
        if not existing_resource:
            raise EntityNotFound("Resource not found")

        # wrap existing_resource to pydantic model to avoid sqlalchemy object state issues
        pydantic_resource = ResourceDTO.model_validate(existing_resource)

        await self.audit_log_handler.create_log(
            pydantic_resource.id, requester.id, body.action, revision_number=pydantic_resource.revision_number
        )

        match body.action:
            case ModelActions.REJECT:
                await self.action_reject(existing_resource, pydantic_resource, requester)
                await self.publish_notification_event(existing_resource, "rejected")

            case ModelActions.RETRY:
                if existing_resource.status == ModelStatus.QUEUED:
                    await self.event_sender.send_task(
                        existing_resource.id,
                        requester=requester,
                        trace_id=trace_id or self.audit_log_handler.trace_id,
                        audit_log_id=self.audit_log_handler.audit_log_id,
                        action=ModelActions.EXECUTE,
                    )
                else:
                    raise EntityWrongState("Only resources in QUEUED status can be retried")

            case ModelActions.APPROVE:
                # Apply temp state changes to existing_resource if values differ
                await self.action_approve(existing_resource, pydantic_resource, requester)
                await self.publish_notification_event(existing_resource, "approve")
            case ModelActions.DESTROY:
                await self.action_destroy(existing_resource, pydantic_resource, requester)
                await self.publish_notification_event(existing_resource, "destroy")
            case ModelActions.EXECUTE:
                await execute_entity(existing_resource)
                await self.event_sender.send_task(
                    pydantic_resource.id,
                    requester=requester,
                    trace_id=trace_id or self.audit_log_handler.trace_id,
                    audit_log_id=self.audit_log_handler.audit_log_id,
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
                    trace_id=trace_id or self.audit_log_handler.trace_id,
                    audit_log_id=self.audit_log_handler.audit_log_id,
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
                    trace_id=trace_id or self.audit_log_handler.trace_id,
                    audit_log_id=self.audit_log_handler.audit_log_id,
                )
            case ModelActions.RECREATE:
                await self.action_recreate(existing_resource, requester)
                await self.publish_notification_event(existing_resource, "recreate")

            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = ResourceResponse.model_validate(existing_resource)
        await self.event_sender.send_event(response, body.action)
        return existing_resource

    async def patch_action(
        self, resource_id: str | UUID, body: PatchBodyModel, requester: UserDTO, trace_id: str | None = None
    ) -> ResourceResponse:
        result = await self.patch_action_resource(
            resource_id=resource_id, body=body, requester=requester, trace_id=trace_id
        )
        return ResourceResponse.model_validate(result)

    async def delete(self, resource_id: str, requester: UserDTO) -> None:
        existing_resource = await self.crud.get_by_id(resource_id)
        if not existing_resource:
            raise EntityNotFound("Resource not found")

        resource_temp_state = await self.resource_temp_state_handler.get_by_resource_id(
            resource_id=existing_resource.id
        )
        if resource_temp_state is not None:
            await self.resource_temp_state_handler.delete_by_resource_id(resource_id=existing_resource.id)

        await self.favorite_service.delete_all_by_component(component_type="resource", component_id=resource_id)

        await delete_entity(existing_resource)
        await self.audit_log_handler.create_log(resource_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(resource_id)
        await self.log_service.delete_by_entity_id(resource_id)
        await self.task_service.delete_by_entity_id(resource_id)
        await delete_resource_policies(resource_id, self.permission_service)
        await self.subscription_service.delete_many_by_entity_id("resource", resource_id)
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
                node_id=uuid4(),
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
        :param source_code_version_id: ID of the source code version
        :param resource_ids: List of resource IDs to get the schema for
        :return: Dictionary representing the variable schema
        """

        invalid_ids = [rid for rid in resource_ids if not is_valid_uuid(rid)]
        if invalid_ids:
            raise ValueError(f"Invalid resource ID(s): {', '.join(str(i) for i in invalid_ids)}")

        resource_scv = await self.service_source_code_version.get_by_id_with_configs(source_code_version_id)
        if not resource_scv:
            raise EntityNotFound("Source code version not found")

        validation_rules_map = await self.validation_rule_service.get_rules_map_for_template(
            template_id=resource_scv.template.id
        )

        if not resource_ids:
            return get_resource_variable_schema(resource_scv, [], [], validation_rules_map)

        parents_lists: list[list[ResourceWithConfigs]] = await asyncio.gather(
            *[self.get_parents_with_configs(rid) for rid in resource_ids]
        )
        parents: list[ResourceWithConfigs] = [p for sublist in parents_lists for p in sublist]

        # Deduplicate SCV IDs before the batch fetch to avoid redundant DB work.
        parent_source_code_version_ids: list[UUID] = list(
            {parent.source_code_version_id for parent in parents if parent.source_code_version_id}
        )

        # Skip the batch call entirely when there are no parent SCVs.
        if parent_source_code_version_ids:
            parent_scvs = await self.service_source_code_version.get_scvs_with_configs_and_outputs(
                source_code_version_ids=parent_source_code_version_ids
            )
        else:
            parent_scvs = []

        schema = get_resource_variable_schema(resource_scv, parents, parent_scvs, validation_rules_map)
        return sorted(schema, key=lambda item: item.index)

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

        if resource.integration_ids is None:
            raise EntityNotFound(f"Resource with id {resource_id} has no integration_ids")

        comp = await self.template_service.get_by_id(resource.template.id)

        if not comp:
            raise EntityNotFound("Template not found")

        template = TemplateResponse.model_validate(comp)

        assert template.cloud_resource_types is not None, f"Template with id {template.id} has no cloud_resource_types"
        assert len(template.cloud_resource_types) > 0, f"Template with id {template.id} has no cloud_resource_types"

        integrations = await self.integration_service.get_all(
            filter={"id": [str(i.id) for i in resource.integration_ids]}
        )
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

    # Permissions
    async def create_resource_policy(
        self,
        resource_policy: EntityPolicyCreate,
        requester: UserDTO,
    ) -> list[Permission]:
        inherit = resource_policy.inherits_children
        resource = await self.get_by_id(resource_policy.entity_id)
        if not resource:
            raise EntityNotFound(f"Resource {resource_policy.entity_id} not found")

        policies: list[Permission] = []
        if inherit:
            # create policies for resource and all its children
            resource_tree = await self.crud.get_tree_to_children(str(resource.id))
            resource_ids = []
            for node in resource_tree:
                if node["id"] not in resource_ids:
                    resource_ids.append(node["id"])

            for res_id in resource_ids:
                try:
                    policy = await self.permission_service.create_entity_policy(
                        EntityPolicyCreate(
                            role=resource_policy.role,
                            entity_id=res_id,
                            entity_name="resource",
                            action=resource_policy.action,
                        ),
                        requester,
                        reload_permission=False,
                    )
                    policies.append(policy)
                except EntityExistsError:
                    # skip existing policies
                    continue
            await self.permission_service.casbin_enforcer.send_reload_event()
            return policies
        # create policy
        policy = await self.permission_service.create_entity_policy(resource_policy, requester, reload_permission=False)
        policies.append(policy)
        await self.permission_service.casbin_enforcer.send_reload_event()
        return policies

    async def delete_resource_policy_cascade(self, permission_id: str, requester: UserDTO) -> int:
        permission = await self.permission_service.query_by_id(permission_id)
        if permission is None:
            raise EntityNotFound("Permission not found")

        if permission.ptype != "p" or permission.v0 is None or permission.v1 is None or permission.v2 is None:
            raise ValueError("Only entity policies can be cascade deleted")

        entity_name, _, entity_id = permission.v1.partition(":")
        if entity_name != "resource" or not entity_id:
            raise ValueError("Cascade delete is only supported for resource policies")

        resource = await self.get_by_id(entity_id)
        if not resource:
            raise EntityNotFound(f"Resource {entity_id} not found")

        resource_tree = await self.crud.get_tree_to_children(entity_id)
        resource_ids: list[str] = []
        seen: set[str] = set()
        for node in resource_tree:
            node_id = str(node["id"])
            if node_id not in seen:
                seen.add(node_id)
                resource_ids.append(node_id)

        policies_to_delete = await self.permission_service.query_all(
            filter={
                "ptype": "p",
                "v0": permission.v0,
                "v1__in": [f"resource:{resource_id}" for resource_id in resource_ids],
                "v2": permission.v2,
            }
        )

        deleted_count = 0
        for policy in policies_to_delete:
            await self.permission_service.crud.delete(policy)
            deleted_count += 1

        if deleted_count:
            await self.permission_service.audit_log_handler.create_log(permission.id, requester.id, ModelActions.DELETE)
            await self.permission_service.casbin_enforcer.send_reload_event()

        return deleted_count

    async def create_resource_subscription(
        self,
        resource_id: str,
        requester: UserDTO,
        inherit_children: bool = False,
        user_id: str | None = None,
    ) -> list[Subscription]:
        resource = await self.get_by_id(resource_id)
        if not resource:
            raise EntityNotFound(f"Resource {resource_id} not found")

        target_user_id = user_id or str(requester.id)

        if not inherit_children:
            resource_ids_to_subscribe = [resource_id]
        else:
            resource_tree = await self.crud.get_tree_to_children(resource_id)
            seen: set[str] = set()
            resource_ids_to_subscribe = []
            for node in resource_tree:
                node_id = str(node["id"])
                if node_id not in seen:
                    seen.add(node_id)
                    resource_ids_to_subscribe.append(node_id)

        # Fetch all existing subscriptions for this user + entity_type in one query
        existing_subscriptions = await self.subscription_service.query_all(
            filter={"user_id": target_user_id, "entity_type": "resource", "entity_id": resource_ids_to_subscribe}
        )
        already_subscribed = {str(s.entity_id) for s in existing_subscriptions}

        # Only create subscriptions for resources not already subscribed
        ids_to_create = [rid for rid in resource_ids_to_subscribe if rid not in already_subscribed]

        subscriptions: list[Subscription] = list(existing_subscriptions)
        for res_id in ids_to_create:
            subscription = await self.subscription_service.create(
                requester=requester,
                entity_type="resource",
                entity_id=res_id,
                user_id=user_id,
            )
            subscriptions.append(subscription)
        return subscriptions

    async def delete_resource_subscription(
        self,
        resource_id: str,
        requester: UserDTO,
        inherit_children: bool = False,
        user_id: str | None = None,
    ) -> bool:
        resource = await self.get_by_id(resource_id)
        if not resource:
            raise EntityNotFound(f"Resource {resource_id} not found")

        target_user_id = user_id or str(requester.id)

        if not inherit_children:
            resource_ids_to_unsubscribe = [resource_id]
        else:
            resource_tree = await self.crud.get_tree_to_children(resource_id)
            seen: set[str] = set()
            resource_ids_to_unsubscribe = []
            for node in resource_tree:
                node_id = str(node["id"])
                if node_id not in seen:
                    seen.add(node_id)
                    resource_ids_to_unsubscribe.append(node_id)

        subscriptions = await self.subscription_service.query_all(
            filter={
                "user_id": target_user_id,
                "entity_type": "resource",
                "entity_id": resource_ids_to_unsubscribe,
            }
        )

        for subscription in subscriptions:
            await self.subscription_service.delete(subscription_id=subscription.id)
        return True

    async def sync_workspace(self, resource_id: str, requester: UserDTO) -> Resource:
        """
        Sync existing resource with a workspace.
        :param resource_id: ID of the resource to sync
        :param requester: User who sync the resource
        :return: Synced resource
        """
        existing_resource = await self.crud.get_by_id(resource_id)

        if not existing_resource:
            raise EntityNotFound("Resource not found")

        if existing_resource.state not in [ModelState.PROVISIONED, ModelState.DESTROYED]:
            raise ValueError(f"Resource cannot be synced because of the wrong state {existing_resource.state}")

        if existing_resource.workspace_id is None:
            raise EntityNotFound("Resource doesn't have assigned workspace")

        await self.workspace_event_sender.send_task(existing_resource.id, requester=requester, action=ModelActions.SYNC)

        return existing_resource

    async def publish_notification_event(
        self,
        resource: Resource,
        title: str,
        event_type: EventType = EventType.UPDATE,
        status: Literal[
            "info",
            "warning",
            "error",
            "success",
        ] = "warning",
    ) -> None:
        event = NotificationEvent(
            event_type=event_type,
            entity_type="resource",
            entity_id=str(resource.id),
            title=f"Resource {resource.name}",
            status=status,
            message=f"Resource {resource.name} status has been changed ({title.upper()})\n"
            f"New status: {resource.status}, new state: {resource.state}",
        )
        await publish_notification_event(event)
