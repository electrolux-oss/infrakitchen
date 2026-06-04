from typing import Any

from sqlalchemy.orm import joinedload, noload, selectinload

from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options

from .model import Template


def build_template_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options based on requested field spec.

    Args:
        fields: Nested field specification (camelCase or snake_case).
                None means load all fields and relationships.
                Example: {"name": None, "children": {"id": None}, "creator": {"email": None}}
    """
    if fields is None:
        return [
            selectinload(Template.children),
            selectinload(Template.parents),
            joinedload(Template.creator),
        ]

    opts: list[Any] = build_load_only(Template, set(fields.keys()))

    if "children" in fields:
        nested = fields["children"]
        opts.append(selectinload(Template.children).options(*build_template_query_options(nested)))
    else:
        opts.append(noload(Template.children))

    if "parents" in fields:
        nested = fields["parents"]
        opts.append(selectinload(Template.parents).options(*build_template_query_options(nested)))
    else:
        opts.append(noload(Template.parents))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Template.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Template.creator))

    return opts
