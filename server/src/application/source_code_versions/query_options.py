from typing import Any

from sqlalchemy.orm import joinedload, noload, selectinload

from application.source_code_versions.model import (
    SourceCodeVersion,
    SourceConfig,
    SourceConfigTemplateReference,
    SourceOutputConfig,
)
from application.source_codes.query_options import build_source_code_query_options
from application.templates.query_options import build_template_query_options
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_source_config_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for SourceConfig based on requested fields."""
    if fields is None:
        return [noload(SourceConfig.source_code_version)]
    opts: list[Any] = build_load_only(SourceConfig, set(fields.keys()))
    opts.append(noload(SourceConfig.source_code_version))
    return opts


def build_source_output_config_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for SourceOutputConfig based on requested fields."""
    if fields is None:
        return []
    return build_load_only(SourceOutputConfig, set(fields.keys()))


def build_source_config_template_reference_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for SourceConfigTemplateReference based on requested fields."""
    if fields is None:
        return []
    return build_load_only(SourceConfigTemplateReference, set(fields.keys()))


def build_source_code_version_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for SourceCodeVersion based on requested fields."""
    if fields is None:
        return [
            selectinload(SourceCodeVersion.variable_configs),
            selectinload(SourceCodeVersion.output_configs),
            joinedload(SourceCodeVersion.template),
            joinedload(SourceCodeVersion.source_code),
            joinedload(SourceCodeVersion.creator),
        ]

    # Identifier is a computed field that depends on these DB columns.
    if "identifier" in fields:
        fields = dict(fields)
        fields.setdefault("sourceCodeFolder", None)
        fields.setdefault("sourceCodeVersion", None)
        fields.setdefault("sourceCodeBranch", None)

    opts: list[Any] = build_load_only(SourceCodeVersion, set(fields.keys()))

    if "variableConfigs" in fields or "variable_configs" in fields:
        opts.append(selectinload(SourceCodeVersion.variable_configs))
    else:
        opts.append(noload(SourceCodeVersion.variable_configs))

    if "outputConfigs" in fields or "output_configs" in fields:
        opts.append(selectinload(SourceCodeVersion.output_configs))
    else:
        opts.append(noload(SourceCodeVersion.output_configs))

    if "template" in fields:
        nested = fields["template"]
        opts.append(joinedload(SourceCodeVersion.template).options(*build_template_query_options(nested)))
    else:
        opts.append(noload(SourceCodeVersion.template))

    if "sourceCode" in fields or "source_code" in fields:
        nested = fields.get("sourceCode") or fields.get("source_code")
        opts.append(joinedload(SourceCodeVersion.source_code).options(*build_source_code_query_options(nested)))
    else:
        opts.append(noload(SourceCodeVersion.source_code))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(SourceCodeVersion.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(SourceCodeVersion.creator))

    return opts
