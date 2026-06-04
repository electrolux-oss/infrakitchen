import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.functions import filter_template_outputs
from application.source_code_versions.model import (
    SourceCodeVersion,
    SourceConfig,
    SourceConfigTemplateReference,
    SourceOutputConfig,
)
from application.source_code_versions.schema import SourceOutputConfigResponse
from application.source_code_versions.service import SourceCodeVersionService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.source_code_version.converters import (
    source_config_options,
    source_config_template_reference_options,
    source_output_config_options,
)
from graphql_api.modules.source_code_version.types import (
    SourceCodeVersionType,
    SourceConfigTemplateReferenceType,
    SourceConfigType,
    SourceOutputConfigTemplateType,
    SourceOutputConfigType,
)


def _build_service(info: Info) -> SourceCodeVersionService:
    session = info.context["session"]
    return get_source_code_version_service(session=session)


@strawberry.type
class SourceCodeVersionQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_version(self, info: Info, id: uuid.UUID) -> SourceCodeVersionType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "sourceCodeVersion")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_versions(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[SourceCodeVersionType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "sourceCodeVersions")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_versions_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_version_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(source_code_version_id=id, requester=requester)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_version_configs(
        self,
        info: Info,
        source_code_version_id: uuid.UUID,
    ) -> list[SourceConfigType]:
        session = info.context["session"]
        entity_fields = get_entity_selection(info.selected_fields, "sourceCodeVersionConfigs")
        stmt = (
            select(SourceConfig)
            .where(SourceConfig.source_code_version_id == source_code_version_id)
            .options(*source_config_options(entity_fields))
            .order_by(SourceConfig.index.asc())
        )
        result = await session.execute(stmt)
        return result.unique().scalars().all()

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_version_template_references(
        self,
        info: Info,
        template_id: uuid.UUID,
    ) -> list[SourceConfigTemplateReferenceType]:
        session = info.context["session"]
        entity_fields = get_entity_selection(info.selected_fields, "sourceCodeVersionTemplateReferences")
        stmt = (
            select(SourceConfigTemplateReference)
            .where(SourceConfigTemplateReference.template_id == template_id)
            .options(*source_config_template_reference_options(entity_fields))
        )
        result = await session.execute(stmt)
        return result.unique().scalars().all()

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_version_outputs(
        self,
        info: Info,
        source_code_version_id: uuid.UUID,
    ) -> list[SourceOutputConfigType]:
        session = info.context["session"]
        entity_fields = get_entity_selection(info.selected_fields, "sourceCodeVersionOutputs")
        stmt = (
            select(SourceOutputConfig)
            .where(SourceOutputConfig.source_code_version_id == source_code_version_id)
            .options(*source_output_config_options(entity_fields))
            .order_by(SourceOutputConfig.index.asc())
        )
        result = await session.execute(stmt)
        return result.unique().scalars().all()

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_version_template_outputs(
        self,
        info: Info,
        template_id: uuid.UUID,
    ) -> list[SourceOutputConfigTemplateType]:
        session = info.context["session"]
        stmt = (
            select(SourceOutputConfig)
            .join(SourceCodeVersion, SourceOutputConfig.source_code_version_id == SourceCodeVersion.id)
            .where(SourceCodeVersion.template_id == template_id)
            .order_by(SourceCodeVersion.created_at.asc())
        )
        result = await session.execute(stmt)
        outputs = [SourceOutputConfigResponse.model_validate(o) for o in result.unique().scalars().all()]
        filtered = filter_template_outputs(outputs=outputs)
        return [
            SourceOutputConfigTemplateType(
                created_at=o.created_at,
                updated_at=o.updated_at,
                name=o.name,
                description=o.description,
                status=o.status,
            )
            for o in filtered
        ]
