from typing import Any

from sqlalchemy.orm import selectinload

from application.templates.model import Template
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.converters import convert_user


def template_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(Template, fields)
    if "children" in fields:
        opts.append(selectinload(Template.children).noload("*"))
    if "parents" in fields:
        opts.append(selectinload(Template.parents).noload("*"))
    return opts


def convert_template_shallow(obj: Any) -> TemplateType | None:
    """Convert a Template ORM object using only column attributes."""
    if obj is None:
        return None
    return TemplateType(
        id=obj.id,
        name=obj.name,
        description=obj.description,
        template=obj.template,
        cloud_resource_types=obj.cloud_resource_types,
        abstract=obj.abstract,
        configuration=obj.configuration,
        labels=obj.labels,
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=None,
        children=[],
        parents=[],
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


def convert_template(obj: Any, fields: set[str] | None = None) -> TemplateType | None:
    if obj is None:
        return None
    if fields is not None:
        obj = SafeORM(obj)
    return TemplateType(
        id=obj.id,
        name=obj.name,
        description=obj.description,
        template=obj.template,
        cloud_resource_types=obj.cloud_resource_types,
        abstract=obj.abstract,
        configuration=obj.configuration,
        labels=obj.labels,
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        children=(
            [x for x in (convert_template_shallow(c) for c in getattr(obj, "children", []) or []) if x is not None]
            if fields is None or "children" in fields
            else []
        ),
        parents=(
            [x for x in (convert_template_shallow(p) for p in getattr(obj, "parents", []) or []) if x is not None]
            if fields is None or "parents" in fields
            else []
        ),
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
