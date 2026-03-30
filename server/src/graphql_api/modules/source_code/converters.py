from typing import Any

from sqlalchemy.orm import selectinload

from application.source_codes.model import SourceCode
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.integration.converters import convert_integration
from graphql_api.modules.source_code.types import SourceCodeType
from graphql_api.modules.user.converters import convert_user


def source_code_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(SourceCode, fields)
    if "integration" in fields:
        opts.append(selectinload(SourceCode.integration).noload("*"))
    if "creator" in fields:
        opts.append(selectinload(SourceCode.creator))
    return opts


def convert_source_code(obj: Any, fields: set[str] | None = None) -> SourceCodeType | None:
    if obj is None:
        return None
    if fields is not None:
        obj = SafeORM(obj)
    return SourceCodeType(
        id=obj.id,
        description=obj.description,
        source_code_url=obj.source_code_url,
        source_code_provider=obj.source_code_provider,
        source_code_language=obj.source_code_language,
        integration_id=obj.integration_id,
        integration=(
            convert_integration(getattr(obj, "integration", None))
            if fields is None or "integration" in fields
            else None
        ),
        git_tags=obj.git_tags,
        git_branches=obj.git_branches,
        labels=obj.labels,
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
