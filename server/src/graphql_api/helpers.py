import re
from enum import Enum
from typing import Any

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import load_only
from strawberry.permission import BasePermission
from strawberry.types import Info
from strawberry.types.nodes import SelectedField


# --- Auth permission ---


class IsAuthenticated(BasePermission):
    message = "Not authenticated. Please provide a valid bearer token in the Authorization header."

    def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return info.context.get("user") is not None


# --- Field introspection ---


def get_requested_fields(info: Info) -> set[str]:
    """Extract the set of top-level field names requested in the current GraphQL selection."""
    fields: set[str] = set()
    for selection in info.selected_fields:
        for sub in selection.selections:
            if isinstance(sub, SelectedField):
                fields.add(sub.name)
    return fields


def get_nested_fields(info: Info, *path: str) -> set[str]:
    """Extract field names at a nested level in the GraphQL selection.

    Example: ``get_nested_fields(info, "steps")`` returns the set of field
    names requested inside the ``steps`` sub-selection of the query.
    ``get_nested_fields(info, "workflows", "steps")`` goes two levels deep.
    """
    current: list[Any] = list(info.selected_fields)
    for field_name in path:
        next_level: list[Any] = []
        for node in current:
            for sub in getattr(node, "selections", []):
                if isinstance(sub, SelectedField) and sub.name == field_name:
                    next_level.append(sub)
        if not next_level:
            return set()
        current = next_level
    fields: set[str] = set()
    for node in current:
        for sub in getattr(node, "selections", []):
            if isinstance(sub, SelectedField):
                fields.add(sub.name)

    return fields


# --- Column-level load_only ---

_CAMEL_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


def _camel_to_snake(name: str) -> str:
    return _CAMEL_RE.sub("_", name).lower()


def build_load_only(model: type, graphql_fields: set[str]) -> list[Any]:
    """Build load_only() option to SELECT only the SQL columns matching requested GraphQL fields."""
    mapper = sa_inspect(model)
    column_keys = {c.key for c in mapper.column_attrs}
    requested = set()
    for gql_field in graphql_fields:
        snake = _camel_to_snake(gql_field)
        if snake in column_keys:
            requested.add(snake)
    if not requested or len(requested) >= len(column_keys) - 1:
        return []
    return [load_only(*[getattr(model, c) for c in requested])]


# --- Safe ORM proxy ---


class SafeORM:
    """Proxy that returns None for deferred/unloaded ORM attributes instead of raising."""

    __slots__ = ("_obj", "_loaded")

    _obj: Any
    _loaded: set[str]

    def __init__(self, obj: Any) -> None:
        loaded = set(sa_inspect(obj).dict.keys())
        self._obj = obj
        self._loaded = loaded

    def __getattr__(self, name: str) -> Any:
        if name in self._loaded:
            return getattr(self._obj, name)
        return None


# --- Enum helper ---


def enum_val(v: Any) -> Any:
    return v.value if isinstance(v, Enum) else v


# --- Filter / sort / pagination parsers ---


def parse_sort(sort: list[str] | None) -> tuple[str, str] | None:
    """Convert a [field, direction] list into the tuple expected by evaluate_sqlalchemy_sorting."""
    if sort and len(sort) >= 2:
        return (sort[0], sort[1])
    return None


def parse_range(range: list[int] | None) -> tuple[int, int] | None:  # noqa: A002
    """Convert a [skip, end] list into the tuple expected by evaluate_sqlalchemy_pagination."""
    if range and len(range) >= 2:
        return (range[0], range[1])
    return None
