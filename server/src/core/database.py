import json
from typing import Any, TypeVar

from sqlalchemy import BinaryExpression, ColumnElement, and_, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm.query import inspect

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


def evaluate_sqlalchemy_filters(model: type, body: dict[str, Any]) -> list[BinaryExpression[Any] | ColumnElement[Any]]:
    """
    Converts a generic API filter dict with operators into SQLAlchemy filters.
    """
    filters: list[BinaryExpression[Any] | ColumnElement[Any]] = []

    for key, value in body.items():
        field_name = key
        operator = "eq"

        if "__" in key:
            field_name, operator = key.split("__", 1)

        column = getattr(model, field_name, None)
        if column is None:
            raise ValueError(f"Invalid field name: {field_name} in filter")

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
            case _:
                raise ValueError(f"Unsupported operator: {operator} in filter")

    return filters
