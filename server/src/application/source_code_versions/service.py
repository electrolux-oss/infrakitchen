import logging
from typing import Any
from uuid import UUID

from application.source_code_versions.functions import verify_config_type, get_source_code_version_actions
from application.source_code_versions.model import (
    SourceCodeVersion,
    SourceCodeVersionDTO,
    SourceConfig,
    SourceConfigTemplateReference,
    SourceOutputConfig,
)
from application.source_codes.service import SourceCodeService
from application.templates.schema import TemplateResponse
from application.templates.service import TemplateService
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from core.database import FieldSpec, to_dict
from core.errors import DependencyError, EntityNotFound, EntityWrongState
from core.logs.service import LogService
from core.revisions.handler import RevisionHandler
from core.tasks.service import TaskEntityService
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump, valid_uuid
from .crud import SourceCodeVersionCRUD
from .schema import (
    BatchTemplatePortsResponse,
    SourceCodeVersionCreate,
    SourceCodeVersionResponse,
    SourceCodeVersionUpdate,
    SourceCodeVersionWithConfigs,
    SourceConfigCreate,
    SourceConfigResponse,
    SourceConfigTemplateReferenceCreate,
    SourceConfigTemplateReferenceResponse,
    SourceConfigUpdate,
    SourceConfigUpdateWithId,
    SourceOutputConfigCreate,
    SourceOutputConfigResponse,
    SourceOutputConfigTemplateResponse,
    TemplatePortsItem,
)
from core.users.model import UserDTO

from core.constants import ModelStatus

logger = logging.getLogger(__name__)


class SourceCodeVersionService:
    """
    SourceCodeVersionService implements all required business-logic. It uses additional services and utils as helpers
    e.g. SourceCodeVersionCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an
    event, etc
    """

    def __init__(
        self,
        crud: SourceCodeVersionCRUD,
        template_service: TemplateService,
        source_code_service: SourceCodeService,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        log_service: LogService,
        task_service: TaskEntityService,
    ):
        self.crud: SourceCodeVersionCRUD = crud
        self.source_code_service: SourceCodeService = source_code_service
        self.template_service: TemplateService = template_service
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.log_service: LogService = log_service
        self.task_service: TaskEntityService = task_service

    async def get_dto_by_id(self, source_code_version_id: str | UUID) -> SourceCodeVersionDTO | None:
        source_code_version = await self.crud.get_by_id(source_code_version_id)
        if source_code_version is None:
            return None
        return SourceCodeVersionDTO.model_validate(source_code_version)

    async def get_by_id(self, source_code_version_id: str | UUID) -> SourceCodeVersionResponse | None:
        source_code_version = await self.crud.get_by_id(source_code_version_id)
        if source_code_version is None:
            return None
        return SourceCodeVersionResponse.model_validate(source_code_version)

    async def get_by_id_with_configs(self, source_code_version_id: str | UUID) -> SourceCodeVersionWithConfigs | None:
        """
        Get a source code version by its ID with configs.
        :param source_code_version_id: ID of the source code version
        :return: SourceCodeVersionWithConfigs or None
        """
        source_code_version = await self.crud.get_by_id_with_configs(source_code_version_id)
        if source_code_version is None:
            return None
        return SourceCodeVersionWithConfigs.model_validate(source_code_version)

    async def get_all(self, **kwargs) -> list[SourceCodeVersionResponse]:
        source_code_versions = await self.crud.get_all(**kwargs)
        return [
            SourceCodeVersionResponse.model_validate(source_code_version)
            for source_code_version in source_code_versions
        ]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(
        self, source_code_version_id: str | UUID, fields: FieldSpec | None = None
    ) -> SourceCodeVersion | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(source_code_version_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[SourceCodeVersion]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def get_actions(self, source_code_version_id: str | UUID, requester: UserDTO) -> list[str]:
        scv = await self.crud.get_by_id(source_code_version_id, fields={"status": None})
        if not scv:
            raise EntityNotFound("Source code version not found")
        return await get_source_code_version_actions(requester, scv.status)

    async def create_source_code_version(
        self, source_code_version: SourceCodeVersionCreate, requester: UserDTO
    ) -> SourceCodeVersion:
        """
        Create a new source_code_version and return the ORM model.
        :param source_code_version: SourceCodeVersionCreate to create
        :param requester: User who creates the source_code_version
        :return: Created source_code_version ORM model
        """

        if not (source_code_version.source_code_version or source_code_version.source_code_branch):
            raise ValueError("One of source code tag or branch is required")

        if source_code_version.source_code_version and source_code_version.source_code_branch:
            raise ValueError("Only one of source code tag or branch is allowed")

        if not source_code_version.source_code_folder:
            raise ValueError("Source code folder is required")

        template = await self.template_service.get_by_id(source_code_version.template_id)
        if not template:
            raise EntityNotFound("Template not found")
        if template.status != ModelStatus.ENABLED:
            raise EntityWrongState("Template is not enabled")

        source_code = await self.source_code_service.get_by_id(source_code_version.source_code_id)

        if not source_code:
            raise EntityNotFound("SourceCode not found")

        if source_code.status == ModelStatus.DISABLED:
            raise EntityWrongState("SourceCode is not enabled")

        # Validate that branch or tag exists in source code
        if source_code_version.source_code_branch:
            if source_code_version.source_code_branch not in source_code.git_branches:
                raise ValueError("Source code branch not found in source code")

            if ref_folder := next(
                (
                    folder
                    for folder in source_code.git_folders_map
                    if folder.ref == source_code_version.source_code_branch
                ),
                None,
            ):
                if source_code_version.source_code_folder not in ref_folder.folders:
                    raise ValueError("Source code folder not found in source code for the specified branch")
            else:
                raise ValueError("Source code branch not found in source code")
        elif source_code_version.source_code_version:
            if source_code_version.source_code_version not in source_code.git_tags:
                raise ValueError("Source code version tag not found in source code")

            if ref_folder := next(
                (
                    folder
                    for folder in source_code.git_folders_map
                    if folder.ref == source_code_version.source_code_version
                ),
                None,
            ):
                if source_code_version.source_code_folder not in ref_folder.folders:
                    raise ValueError("Source code folder not found in source code for the specified version tag")
            else:
                raise ValueError("Source code version tag not found in folder map of source code")

        body = source_code_version.model_dump(exclude_unset=True)
        body["created_by"] = requester.id
        new_source_code_version = await self.crud.create(body)
        new_source_code_version.status = ModelStatus.READY
        result = await self.crud.get_by_id(new_source_code_version.id)

        if not result:
            raise EntityNotFound("SourceCodeVersion not found after creation")

        await self.revision_handler.handle_revision(new_source_code_version)
        await self.audit_log_handler.create_log(
            new_source_code_version.id,
            requester.id,
            ModelActions.CREATE,
            revision_number=new_source_code_version.revision_number,
        )
        response = SourceCodeVersionResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return result

    async def create(
        self, source_code_version: SourceCodeVersionCreate, requester: UserDTO
    ) -> SourceCodeVersionResponse:
        """
        Create a new source_code_version.
        :param source_code_version: SourceCodeVersionCreate to create
        :param requester: User who creates the source_code_version
        :return: Created source_code_version
        """
        new_source_code_version = await self.create_source_code_version(
            source_code_version=source_code_version, requester=requester
        )
        return SourceCodeVersionResponse.model_validate(new_source_code_version)

    async def update_source_code_version(
        self,
        source_code_version_id: str,
        source_code_version: SourceCodeVersionUpdate,
        requester: UserDTO,
    ) -> SourceCodeVersion:
        """
        Update an existing source_code_version and return the ORM model.
        :param source_code_version_id: ID of the source_code_version to update
        :param source_code_version: SourceCodeVersion to update
        :param requester: User who updates the source_code_version
        :return: Updated source_code_version ORM model
        """

        # TODO: Add validation for output referenced
        # should be None if output is not referenced
        # can not be referenced few times on the same source code version output
        # Can not be self referenced
        # if config variable is unique, it should be required as well
        #
        # check if resources already created with non unique variable when config is changed to unique or required
        #    and do exception if it exists

        body = model_db_dump(source_code_version, exclude_defaults=True, exclude_none=True)
        existing_source_code_version = await self.crud.get_by_id(source_code_version_id)

        if not existing_source_code_version:
            raise EntityNotFound("SourceCodeVersion not found")

        if existing_source_code_version.status in [ModelStatus.DISABLED, ModelStatus.IN_PROGRESS]:
            logger.error(f"Entity has wrong status for updating {existing_source_code_version.status}")
            raise ValueError(f"Entity has wrong status for updating {existing_source_code_version.status}")

        if not has_field_changes(body, existing_source_code_version):
            raise ValueError("No changes detected; the source code version is already up to date.")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_source_code_version)

        await self.crud.update(existing_source_code_version, body)

        await self.revision_handler.handle_revision(existing_source_code_version)
        await self.audit_log_handler.create_log(
            source_code_version_id,
            requester.id,
            ModelActions.UPDATE,
            revision_number=existing_source_code_version.revision_number,
        )
        await self.crud.refresh(existing_source_code_version)
        response = SourceCodeVersionResponse.model_validate(existing_source_code_version)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return existing_source_code_version

    async def update(
        self,
        source_code_version_id: str,
        source_code_version: SourceCodeVersionUpdate,
        requester: UserDTO,
    ) -> SourceCodeVersionResponse:
        """
        Update an existing source_code_version.
        :param source_code_version_id: ID of the source_code_version to update
        :param source_code_version: SourceCodeVersion to update
        :param requester: User who updates the source_code_version
        :return: Updated source_code_version
        """
        existing_source_code_version = await self.update_source_code_version(
            source_code_version_id=source_code_version_id,
            source_code_version=source_code_version,
            requester=requester,
        )
        return SourceCodeVersionResponse.model_validate(existing_source_code_version)

    async def patch_action(
        self, source_code_version_id: str, body: PatchBodyModel, requester: UserDTO
    ) -> SourceCodeVersion:
        """
        Patch an existing source_code_version and return the ORM model.
        :param source_code_version_id: ID of the source_code_version to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the source_code_version
        :return: Patched source_code_version ORM instance
        """
        existing_source_code_version = await self.crud.get_by_id(source_code_version_id)
        if not existing_source_code_version:
            raise EntityNotFound("SourceCodeVersion not found")

        await self.audit_log_handler.create_log(
            existing_source_code_version.id,
            requester.id,
            body.action,
            revision_number=existing_source_code_version.revision_number,
        )

        match body.action:
            case ModelActions.DISABLE:
                existing_source_code_version.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing_source_code_version.status == ModelStatus.DISABLED:
                    existing_source_code_version.status = ModelStatus.READY
                else:
                    raise EntityWrongState("Version is already enabled")
            case ModelActions.SYNC:
                if existing_source_code_version.status in [ModelStatus.IN_PROGRESS, ModelStatus.DISABLED]:
                    raise EntityWrongState(f"Entity has wrong status for syncing {existing_source_code_version.status}")

                await self.event_sender.send_task(
                    existing_source_code_version.id,
                    requester=requester,
                    trace_id=self.audit_log_handler.trace_id,
                    audit_log_id=self.audit_log_handler.audit_log_id,
                    action=ModelActions.SYNC,
                )
            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = SourceCodeVersionResponse.model_validate(existing_source_code_version)
        await self.event_sender.send_event(response, body.action)
        return existing_source_code_version

    async def patch(
        self, source_code_version_id: str, body: PatchBodyModel, requester: UserDTO
    ) -> SourceCodeVersionResponse:
        """
        Patch an existing source_code_version.
        :param source_code_version_id: ID of the source_code_version to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the source_code_version
        :return: Patched source_code_version
        """
        result = await self.patch_action(source_code_version_id=source_code_version_id, body=body, requester=requester)
        return SourceCodeVersionResponse.model_validate(result)

    async def delete(self, source_code_version_id: str, requester: UserDTO) -> None:
        existing_source_code_version = await self.crud.get_by_id(source_code_version_id)
        if not existing_source_code_version:
            raise EntityNotFound("SourceCodeVersion not found")

        if existing_source_code_version.status != ModelStatus.DISABLED:
            raise EntityWrongState(f"Entity has wrong status for deleting {existing_source_code_version.status}")

        dependencies = await self.crud.get_dependencies(existing_source_code_version)
        if dependencies:
            raise DependencyError(
                "Cannot delete a source_code_version that has dependencies",
                metadata=[
                    {
                        "id": dependency.id,
                        "name": dependency.name,
                        "_entity_name": dependency.type,
                    }
                    for dependency in dependencies
                ],
            )

        await self.audit_log_handler.create_log(source_code_version_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(source_code_version_id)
        await self.log_service.delete_by_entity_id(source_code_version_id)
        await self.task_service.delete_by_entity_id(source_code_version_id)
        await self.crud.delete(existing_source_code_version)

    async def get_configs_by_scv_id(self, source_code_version_id: str | UUID) -> list[SourceConfigResponse]:
        """
        Get all configs for a source code version.
        :param source_code_version_id: ID of the source code version
        :return: List of SourceConfigResponse
        """
        configs = await self.crud.get_configs_by_scv_id(source_code_version_id)
        return [SourceConfigResponse.model_validate(config) for config in configs]

    async def get_configs_by_template_id(self, template_id: str | UUID) -> list[SourceConfigResponse]:
        """
        Get all configs for all source code versions of a template.
        :param template_id: ID of the template
        :return: List of SourceConfigResponse (deduplicated by name)
        """
        configs = await self.crud.get_configs_by_template_id(template_id)
        seen_names: set[str] = set()
        unique_configs: list[SourceConfigResponse] = []
        for config in configs:
            if config.name not in seen_names:
                seen_names.add(config.name)
                unique_configs.append(SourceConfigResponse.model_validate(config))
        return unique_configs

    async def get_config_by_id(self, config_id: str) -> SourceConfigResponse | None:
        """
        Get a config by its ID.
        :param config_id: ID of the config
        :return: SourceConfigResponse or None
        """
        config = await self.crud.get_config_by_id(config_id)
        if not config:
            raise EntityNotFound("SourceCodeVersionConfig not found")
        return SourceConfigResponse.model_validate(config)

    async def create_configs(self, configs: list[SourceConfigCreate]) -> list[SourceConfigResponse]:
        """
        Create new source code version configs.
        :param body: List of SourceConfigCreate to create
        :return: None
        """
        result: list[SourceConfig] = []
        for c in configs:
            config = await self.crud.create_config(c.model_dump(exclude_unset=True))
            result.append(config)
        return [SourceConfigResponse.model_validate(config) for config in result]

    async def update_config(self, config_id: str, config: SourceConfigUpdate) -> SourceConfigResponse:
        """
        Update an existing source code version config.
        :param config_id: ID of the source code version config to update
        :param config: SourceConfigUpdate to update
        :return: Updated source code version config
        """
        existing_config = await self.crud.get_config_by_id(config_id)
        if not existing_config:
            raise EntityNotFound("SourceCodeVersionConfig not found")

        body = config.model_dump(exclude_unset=True)
        await self.crud.update_config(existing_config, body)
        return SourceConfigResponse.model_validate(existing_config)

    async def update_template_references(self, template_references: list[SourceConfigTemplateReferenceCreate]) -> None:
        """
        Update or create template references for source code version configs.
        Delete existing references if output_config_name or reference_template_id is None.
        :param template_references: List of SourceConfigTemplateReferenceCreate to create
        :return: None
        """

        def get_existing_reference(
            reference: SourceConfigTemplateReferenceCreate,
            existing_references: list[SourceConfigTemplateReference],
        ) -> SourceConfigTemplateReference | None:
            for er in existing_references:
                if er.template_id == reference.template_id and er.input_config_name == reference.input_config_name:
                    return er
            return None

        existing_references = await self.crud.get_reference_output_configs_by_template_id(
            template_references[0].template_id
        )
        for tr in template_references:
            existing_reference = get_existing_reference(tr, existing_references)
            if existing_reference:
                if tr.output_config_name is None or tr.reference_template_id is None:
                    await self.crud.delete_template_references(existing_reference)
                elif (
                    existing_reference.output_config_name != tr.output_config_name
                    or existing_reference.reference_template_id != tr.reference_template_id
                ):
                    if not await self.template_service.get_by_id(tr.reference_template_id):
                        raise EntityNotFound(f"Template reference not found with id {tr.reference_template_id}")

                    template_outputs = await self.get_output_configs_by_template_id(tr.reference_template_id)
                    output_config_names = [output.name for output in template_outputs]
                    if tr.output_config_name not in output_config_names:
                        raise EntityNotFound(
                            f"Output config with name {tr.output_config_name} not found in template "
                            f"{tr.reference_template_id}"
                        )
                    await self.crud.update_template_references(
                        existing_reference,
                        tr.model_dump(exclude_unset=True),
                    )
            else:
                if tr.output_config_name is None or tr.reference_template_id is None:
                    continue
                if not await self.template_service.get_by_id(tr.reference_template_id):
                    raise EntityNotFound(f"Template reference not found with id {tr.reference_template_id}")

                template_outputs = await self.get_output_configs_by_template_id(tr.reference_template_id)
                output_config_names = [output.name for output in template_outputs]
                if tr.output_config_name not in output_config_names:
                    raise EntityNotFound(
                        f"Output config with name {tr.output_config_name} not found in template "
                        f"{tr.reference_template_id}"
                    )

                await self.crud.create_template_references(tr.model_dump(exclude_unset=True))

    async def update_configs(
        self, source_code_version_id: str | UUID, configs: list[SourceConfigUpdateWithId]
    ) -> list[SourceConfigResponse]:
        """
        Update existing source code version configs.
        :param source_code_version_id: ID of the source code version
        :param configs: List of SourceConfigUpdate to update
        :return: List of updated source code version configs
        """
        existing_configs = await self.crud.get_configs_by_scv_id(source_code_version_id)
        existing_configs_dict = {config.id: config for config in existing_configs}
        updated_configs: list[SourceConfigResponse] = []
        template_references_to_create: list[SourceConfigTemplateReferenceCreate] = []
        template_id = None
        template = await self.template_service.get_by_id(configs[0].template_id)
        if not template:
            raise EntityNotFound("Template not found")

        for config in configs:
            if config.id not in existing_configs_dict:
                raise EntityNotFound(f"SourceCodeVersionConfig with id {config.id} not found")

            if not template_id:
                template_id = config.template_id
            elif template_id != config.template_id:
                raise ValueError("All configs must belong to the same template")

            if config.required and config.restricted and not config.default:
                raise ValueError("Restricted config must have a value if it is required")

            body = config.model_dump(exclude_unset=True)
            verify_config_type(body, expected_type=existing_configs_dict[config.id].type)
            await self.crud.update_config(existing_configs_dict[config.id], body)
            updated_configs.append(SourceConfigResponse.model_validate(existing_configs_dict[config.id]))

            # Handle template references
            pydantic_config = SourceConfigResponse.model_validate(existing_configs_dict[config.id])
            template_reference = SourceConfigTemplateReferenceCreate(
                template_id=template_id,
                reference_template_id=config.reference_template_id,
                input_config_name=pydantic_config.name,
                output_config_name=config.output_config_name,
            )
            template_references_to_create.append(template_reference)

        if template_references_to_create:
            await self.update_template_references(template_references=template_references_to_create)

        return updated_configs

    async def get_output_configs_by_scv_id(self, source_code_version_id: str) -> list[SourceOutputConfigResponse]:
        """
        Get all output configs for a source code version.
        :param source_code_version_id: ID of the source code version
        :return: List of SourceOutputConfigResponse
        """
        configs = await self.crud.get_output_by_scv_id(source_code_version_id)
        return [SourceOutputConfigResponse.model_validate(config) for config in configs]

    async def get_output_configs_by_template_id(self, template_id: str | UUID) -> list[SourceOutputConfigResponse]:
        """
        Get all output configs for a template.
        :param template_id: ID of the template
        :return: List of SourceOutputConfigResponse
        """
        configs = await self.crud.get_output_by_template_id(template_id)
        return [SourceOutputConfigResponse.model_validate(config) for config in configs]

    async def get_template_config_references_by_template_id(
        self, template_id: str | UUID
    ) -> list[SourceConfigTemplateReferenceResponse]:
        """
        Get all output configs for a template.
        :param template_id: ID of the template
        :return: List of SourceConfigTemplateAssociationResponse
        """
        references = await self.crud.get_reference_output_configs_by_template_id(template_id)
        return [SourceConfigTemplateReferenceResponse.model_validate(reference) for reference in references]

    async def get_batch_template_ports(self, template_ids: list[UUID]) -> BatchTemplatePortsResponse:
        """
        Get configs, outputs, references, and parents for multiple templates in one call.
        Replaces N individual calls with 3 batch DB queries + 1 template list query.
        """

        # 3 batch queries in parallel-ish (all hit the same session, but no fan-out)
        configs_by_tid = await self.crud.get_configs_by_template_ids(template_ids)
        outputs_by_tid = await self.crud.get_outputs_by_template_ids(template_ids)
        refs_by_tid = await self.crud.get_references_by_template_ids(template_ids)

        # Fetch all templates at once to get their parents
        templates = await self.template_service.get_all(filter={"id": [str(tid) for tid in template_ids]})

        result: list[TemplatePortsItem] = []
        for template in templates:
            template_id = template.id

            # Deduplicate configs by name (same logic as get_configs_by_template_id)
            raw_configs = configs_by_tid.get(template_id, [])
            seen_names: set[str] = set()
            unique_configs: list[SourceConfigResponse] = []
            for config in raw_configs:
                if config.name not in seen_names:
                    seen_names.add(config.name)
                    unique_configs.append(SourceConfigResponse.model_validate(config))

            # Deduplicate outputs by name (same logic as filter_template_outputs)
            raw_outputs = outputs_by_tid.get(template_id, [])
            template_outputs_dict: dict[str, tuple[SourceOutputConfigTemplateResponse, int]] = {}
            for output in raw_outputs:
                validated = SourceOutputConfigResponse.model_validate(output)
                if validated.name not in template_outputs_dict:
                    template_output = SourceOutputConfigTemplateResponse(
                        name=validated.name,
                        description=validated.description,
                        created_at=validated.created_at,
                        updated_at=validated.updated_at,
                        status="new",
                    )
                    template_outputs_dict[validated.name] = (template_output, 0)
                else:
                    template_outputs_dict[validated.name] = (
                        template_outputs_dict[validated.name][0],
                        template_outputs_dict[validated.name][1] + 1,
                    )
            for output_item, count in template_outputs_dict.values():
                if count >= 1:
                    output_item.status = "active"
            filtered_outputs = [t[0] for t in template_outputs_dict.values()]

            # References
            refs = refs_by_tid.get(template_id, [])
            validated_refs = [SourceConfigTemplateReferenceResponse.model_validate(r) for r in refs]

            result.append(
                TemplatePortsItem(
                    template=TemplateResponse.model_validate(next(t for t in templates if t.id == template_id)),
                    configs=unique_configs,
                    outputs=filtered_outputs,
                    references=validated_refs,
                )
            )

        return BatchTemplatePortsResponse(templates=result)

    async def create_output_configs(self, body: list[SourceOutputConfigCreate]) -> list[SourceOutputConfig]:
        """
        Create new source code version output configs.
        :param body: List of SourceOutputConfigCreate to create
        :return: None
        """
        result: list[SourceOutputConfig] = []
        for c in body:
            config = await self.crud.create_output_config(c.model_dump(exclude_unset=True))
            result.append(config)
        return result

    async def get_scvs_with_configs_and_outputs(
        self, source_code_version_ids: list[UUID]
    ) -> list[SourceCodeVersionWithConfigs]:
        """
        Get all source code versions with variable configs and output configs.
        :param source_code_version_ids: List of source code version IDs
        :return: List of SourceCodeVersionResponse
        """
        scvs = await self.crud.get_scvs_with_configs_and_outputs(
            [valid_uuid(scv_id) for scv_id in source_code_version_ids]
        )
        return [SourceCodeVersionWithConfigs.model_validate(scv) for scv in scvs]
