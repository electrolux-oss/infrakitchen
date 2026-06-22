import json
import re
from typing import Any, TypeVar

from sqlalchemy import BinaryExpression, ColumnElement, and_, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import RelationshipProperty, aliased, load_only
from sqlalchemy.orm.query import inspect
from sqlalchemy.sql.selectable import Select

from core.base_models import Base
from core.utils.json_encoder import JsonEncoder
from core.utils.model_tools import is_valid_uuid, valid_uuid
from core.utils.event_sender import flush_all_pending_senders

from core.config import setup_service_environment

setup_service_environment()

from core.config import Settings  # noqa: E402


engine = create_async_engine(
    str(Settings().db_url),
    pool_size=20,
    max_overflow=40,
    json_serializer=lambda obj: json.dumps(obj, cls=JsonEncoder),
)


class EventFlushingSession(AsyncSession):
    """AsyncSession subclass that flushes buffered EventSender messages
    after each commit, guaranteeing consumers always see committed data."""

    async def commit(self):
        await super().commit()
        await flush_all_pending_senders()


SessionLocal = async_sessionmaker(engine, class_=EventFlushingSession, expire_on_commit=False)

T = TypeVar("T", bound=Base)


def to_dict(obj: Base) -> dict[str, Any]:
    """Convert a SQLAlchemy object to a dictionary."""
    values = {}
    for c in inspect(obj).mapper.column_attrs:
        if c.key in ["updated_at", "created_at"]:
            continue
        values[c.key] = getattr(obj, c.key)
    return values


def is_column_relationship(model: type, attr_name: str) -> bool:
    if attr_name not in model.__mapper__.all_orm_descriptors:
        return False

    attr = model.__mapper__.get_property(attr_name)

    is_relationship = isinstance(attr, RelationshipProperty)

    return is_relationship


def evaluate_sqlalchemy_sorting(
    model: type,
    statement: Select[Any],
    sort: tuple[str, str] | None = None,
) -> Select[Any]:
    """
    Converts a generic API sorting tuple into SQLAlchemy sorting.
    Supports dot-notation for relationship fields (e.g. "template.name").
    """
    sorting: list[ColumnElement[Any]] = []

    if sort is None:
        return statement

    field_name, direction = sort

    if direction.lower() not in ["asc", "desc"]:
        raise ValueError(f"Unsupported sorting direction: {direction}")

    field_name = _camel_to_snake(field_name)

    # Handle dot-notation for relationship sorting (e.g. "template.name")
    if "." in field_name:
        rel_name, rel_field = field_name.split(".", 1)
        if not is_column_relationship(model, rel_name):
            return statement
        rel_prop = model.__mapper__.get_property(rel_name)
        related_model = rel_prop.mapper.class_
        if related_model is model:
            # Self-referential relationships need an explicit alias,
            # otherwise SQLAlchemy cannot construct model -> same model joins.
            related_alias = aliased(related_model)
            relationship_attr = getattr(model, rel_name).of_type(related_alias)
            related_column = getattr(related_alias, rel_field, None)
            if related_column is None:
                return statement
            statement = statement.outerjoin(relationship_attr)
            column = related_column
        else:
            related_column = getattr(related_model, rel_field, None)
            if related_column is None:
                return statement
            statement = statement.outerjoin(getattr(model, rel_name))
            column = related_column
    else:
        column = getattr(model, field_name, None)
        if column is None:
            return statement

        if is_column_relationship(model, field_name) is True:
            raise ValueError(f"Cannot sort by relationship field: {field_name}")

    match direction.lower():
        case "asc" | "ASC":
            sorting.append(column.asc())
        case "desc" | "DESC":
            sorting.append(column.desc())
        case _:
            raise ValueError(f"Unsupported sorting direction: {direction}")

    if sorting:
        statement = statement.order_by(*sorting)

    return statement


def evaluate_sqlalchemy_pagination(statement: Select[Any], range: tuple[int, int] | None = None) -> Select[Any]:
    """
    Applies pagination to a SQLAlchemy statement.
    """
    if range:
        skip, end = range
        limit = end - skip
        statement = statement.offset(skip).limit(limit)
    else:
        statement = statement.limit(100)  # default limit

    return statement


def evaluate_sqlalchemy_filters(model: type, statement: Select[Any], body: dict[str, Any] | None) -> Select[Any]:
    """
    Converts a generic API filter dict with operators into SQLAlchemy filters.
    Supports nested relationship filtering using double underscore notation.
    Example: template__name__in will filter by the template's name field using has() for relationships.
    """
    filters: list[BinaryExpression[Any] | ColumnElement[Any]] = []

    if body is None:
        return statement

    for key, value in body.items():
        operator = "eq"
        column = None

        if "__" in key:
            parts = key.split("__")
            potential_operator = parts[-1]

            if potential_operator in ["contains_all", "any", "eq", "like", "in", "not_like"]:
                operator = potential_operator
                field_path = parts[:-1]
            else:
                field_path = parts

            if len(field_path) > 1:
                relationship_attr = getattr(model, field_path[0], None)
                if relationship_attr is None:
                    raise ValueError(f"Invalid field name: {field_path[0]} in filter")

                if not hasattr(relationship_attr.property, "mapper"):
                    raise ValueError(f"Field {field_path[0]} is not a relationship")

                related_model = relationship_attr.property.mapper.class_
                related_column = getattr(related_model, field_path[1], None)
                if related_column is None:
                    raise ValueError(f"Invalid field name: {field_path[1]} in related model")

                relation_filter = None
                if operator == "in" and isinstance(value, list) and value:
                    relation_filter = related_column.in_(value)
                elif operator == "eq":
                    relation_filter = related_column == value
                elif operator == "like":
                    relation_filter = related_column.ilike(f"%{value}%")
                elif operator == "not_like":
                    relation_filter = ~related_column.ilike(f"%{value}%")
                else:
                    raise ValueError(f"Operator {operator} not supported for nested relationships")

                if relation_filter is not None:
                    filters.append(relationship_attr.has(relation_filter))
                continue
            else:
                column = getattr(model, field_path[0], None)
        else:
            column = getattr(model, key, None)

        if column is None:
            raise ValueError(f"Invalid field name: {key} in filter")

        match operator:
            case "contains_all":
                if isinstance(value, list) and value:
                    conditions = [cast(column, JSONB).op("?")(label) for label in value]
                    filters.append(and_(*conditions))

            case "any":
                if isinstance(value, list):
                    if not value:
                        continue

                    ids_to_filter = []
                    if all(is_valid_uuid(v) for v in value):
                        ids_to_filter = [valid_uuid(v) for v in value]
                    else:
                        ids_to_filter = value

                    if ids_to_filter:
                        related_model = column.property.mapper.class_
                        related_id_column = related_model.id
                        filters.append(column.any(related_id_column.in_(ids_to_filter)))

            case "eq":
                if is_valid_uuid(value):
                    filters.append(column == valid_uuid(value))
                    continue

                if isinstance(value, list):
                    if all(is_valid_uuid(v) for v in value):
                        filters.append(column.in_([valid_uuid(v) for v in value]))
                    elif all(isinstance(v, dict) for v in value):
                        nested_ids = [v.get("id") for v in value if "id" in v]
                        if all(is_valid_uuid(nested_id) for nested_id in nested_ids):
                            filters.append(column.in_([valid_uuid(nested_id) for nested_id in nested_ids]))
                        else:
                            filters.append(column.in_(nested_ids))
                    else:
                        filters.append(column.in_(value))
                    continue

                if isinstance(value, dict):
                    if "id" in value:
                        nested_id = value.get("id")
                        if is_valid_uuid(nested_id):
                            filters.append(column == valid_uuid(nested_id))
                        else:
                            filters.append(column == nested_id)
                        continue

                filters.append(column == value)
            case "like":
                filters.append(column.ilike(f"%{value}%"))
            case "not_like":
                filters.append(~column.ilike(f"%{value}%"))
            case "in":
                if isinstance(value, list) and value:
                    filters.append(column.in_(value))
                else:
                    filters.append(column == value)
            case _:
                raise ValueError(f"Unsupported operator: {operator} in filter")

    if filters:
        statement = statement.where(*filters)
    return statement


_CAMEL_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")

# Recursive field specification: keys are field names, values are nested specs or None for leaf fields.
# None as the whole spec means "load everything".
# Example: {"name": None, "children": {"id": None, "name": None}, "creator": {"email": None}}
type FieldSpec = dict[str, "FieldSpec | None"]


def _camel_to_snake(name: str) -> str:
    return _CAMEL_RE.sub("_", name).lower()


def build_load_only(model: type, fields: set[str]) -> list[Any]:
    """Build load_only() option to SELECT only the SQL columns matching requested fields.

    Accepts both camelCase (GraphQL) and snake_case (Python) field names.
    """
    mapper = inspect(model)
    column_keys = {c.key for c in mapper.column_attrs}
    requested = set()
    for field in fields:
        snake = _camel_to_snake(field)
        if snake in column_keys:
            requested.add(snake)
    if not requested or len(requested) >= len(column_keys) - 1:
        return []
    return [load_only(*[getattr(model, c) for c in requested])]
