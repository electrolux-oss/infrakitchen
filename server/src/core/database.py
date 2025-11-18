import json
from typing import Any, TypeVar

from sqlalchemy import BinaryExpression, ColumnElement, and_, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import RelationshipProperty
from sqlalchemy.orm.query import inspect
from sqlalchemy.sql.selectable import Select

from core.base_models import Base
from core.utils.json_encoder import JsonEncoder
from core.utils.model_tools import is_valid_uuid, valid_uuid

from core.config import setup_service_environment

setup_service_environment()

from core.config import Settings  # noqa: E402


engine = create_async_engine(
    str(Settings().db_url),
    pool_size=20,
    max_overflow=40,
    json_serializer=lambda obj: json.dumps(obj, cls=JsonEncoder),
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

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
    """
    sorting: list[ColumnElement[Any]] = []

    if sort is None:
        return statement

    field_name, direction = sort
    column = getattr(model, field_name, None)

    if column is None:
        return statement
        # TODO: need to check UI and fix query there
        # raise ValueError(f"Invalid field name: {field_name} in sorting")

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

        # Handle double-underscore syntax for operators and nested relationships
        if "__" in key:
            parts = key.split("__")
            potential_operator = parts[-1]

            # Check if last part is a valid operator
            if potential_operator in ["contains_all", "any", "eq", "like", "in"]:
                operator = potential_operator
                field_path = parts[:-1]
            else:
                # No operator, treat entire key as field path with default 'eq'
                field_path = parts

            # Handle nested relationship filtering (e.g., template__name__in)
            if len(field_path) > 1:
                relationship_attr = getattr(model, field_path[0], None)
                if relationship_attr is None:
                    raise ValueError(f"Invalid field name: {field_path[0]} in filter")

                # Verify this is a relationship
                if not hasattr(relationship_attr.property, "mapper"):
                    raise ValueError(f"Field {field_path[0]} is not a relationship")

                # Get the related model and field
                related_model = relationship_attr.property.mapper.class_
                related_column = getattr(related_model, field_path[1], None)
                if related_column is None:
                    raise ValueError(f"Invalid field name: {field_path[1]} in related model")

                # Build filter using has() for the relationship
                relation_filter = None
                if operator == "in" and isinstance(value, list) and value:
                    relation_filter = related_column.in_(value)
                elif operator == "eq":
                    relation_filter = related_column == value
                elif operator == "like":
                    relation_filter = related_column.ilike(f"%{value}%")
                else:
                    raise ValueError(f"Operator {operator} not supported for nested relationships")

                if relation_filter is not None:
                    filters.append(relationship_attr.has(relation_filter))
                continue
            else:
                # Simple field with operator (e.g., name__like)
                column = getattr(model, field_path[0], None)
        else:
            # No operator, direct field access
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
            case "in":
                # Support for IN operator with list of values
                if isinstance(value, list) and value:
                    filters.append(column.in_(value))
                else:
                    # If not a list or empty, treat as eq
                    filters.append(column == value)
            case _:
                raise ValueError(f"Unsupported operator: {operator} in filter")

    if filters:
        statement = statement.where(*filters)
    return statement
