from typing import Any

from sqlalchemy.orm import selectinload

from application.source_code_versions.model import SourceCodeVersion
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.source_code.converters import convert_source_code
from graphql_api.modules.source_code_version.types import (
    SourceCodeVersionType,
    SourceConfigType,
    SourceOutputConfigType,
)
from graphql_api.modules.template.converters import convert_template
from graphql_api.modules.user.converters import convert_user


def source_code_version_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(SourceCodeVersion, fields)
    if "variableConfigs" in fields:
        opts.append(selectinload(SourceCodeVersion.variable_configs))
    if "outputConfigs" in fields:
        opts.append(selectinload(SourceCodeVersion.output_configs))
    if "template" in fields:
        opts.append(selectinload(SourceCodeVersion.template).noload("*"))
    if "sourceCode" in fields:
        opts.append(selectinload(SourceCodeVersion.source_code).noload("*"))
    return opts


def _convert_source_config(obj: Any) -> SourceConfigType:
    return SourceConfigType(
        id=obj.id,
        index=obj.index,
        required=obj.required,
        default=obj.default,
        frozen=obj.frozen,
        unique=obj.unique,
        sensitive=obj.sensitive,
        restricted=obj.restricted,
        name=obj.name,
        description=obj.description,
        type=obj.type,
        options=obj.options,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


def _convert_source_output_config(obj: Any) -> SourceOutputConfigType:
    return SourceOutputConfigType(
        id=obj.id,
        index=obj.index,
        name=obj.name,
        description=obj.description,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


def convert_source_code_version(obj: Any, fields: set[str] | None = None) -> SourceCodeVersionType | None:
    if obj is None:
        return None
    if fields is not None:
        obj = SafeORM(obj)
    return SourceCodeVersionType(
        id=obj.id,
        template_id=obj.template_id,
        template=(convert_template(getattr(obj, "template", None)) if fields is None or "template" in fields else None),
        source_code_id=obj.source_code_id,
        source_code=(
            convert_source_code(getattr(obj, "source_code", None)) if fields is None or "sourceCode" in fields else None
        ),
        source_code_version=obj.source_code_version,
        source_code_branch=obj.source_code_branch,
        source_code_folder=obj.source_code_folder,
        variables=obj.variables,
        outputs=obj.outputs,
        description=obj.description,
        labels=obj.labels,
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        variable_configs=(
            [_convert_source_config(c) for c in getattr(obj, "variable_configs", []) or []]
            if fields is None or "variableConfigs" in fields
            else []
        ),
        output_configs=(
            [_convert_source_output_config(c) for c in getattr(obj, "output_configs", []) or []]
            if fields is None or "outputConfigs" in fields
            else []
        ),
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
