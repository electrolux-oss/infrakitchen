from typing import Any

from core.casbin.enforcer import CasbinEnforcer
from core.database import FieldSpec
from core.errors import AccessDenied, AccessUnauthorized
from core.models.encrypted_secret import EncryptedSecretStr
from strawberry.permission import BasePermission
from strawberry.types import Info
from strawberry.types.nodes import SelectedField, Selection

from core.users.functions import user_has_access_to_api, user_is_super_admin
from core.users.model import UserDTO


# --- Auth permission ---


class IsAuthenticated(BasePermission):
    message = "Not authenticated. Please provide a valid bearer token in the Authorization header."

    async def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        return info.context.get("user") is not None


class IsSuperAdmin(BasePermission):
    message = "Access denied. You must be a super admin to perform this action."

    async def has_permission(self, source: Any, info: Info, **kwargs: Any) -> bool:
        user = info.context.get("user")
        return user is not None and await user_is_super_admin(user)


async def check_api_permission(info: Info, entity_name: str, policies: list[str]) -> None:
    user: UserDTO | None = info.context.get("user")
    if user is None:
        raise AccessUnauthorized("Not authenticated.")

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    if casbin_enforcer.enforcer is None:
        raise RuntimeError("Casbin enforcer is not initialized")

    if user.deactivated is True:
        raise AccessUnauthorized("Not authenticated.")

    entity = entity_name.removesuffix("s")

    if entity in (
        "resource",
        "resource_temp_state",
        "executor",
        "favorite",
        "integration",
        "workspace",
    ):
        # Some entities have their own permission control system using the `user_has_access_to_entity` function
        if await user_has_access_to_api(user, entity, "read"):
            return

    for method in policies:
        if await user_has_access_to_api(user, entity, method):
            return

    raise AccessDenied(f"Access denied. You do not have permission to {', '.join(policies)} {entity_name}.")


# --- Field introspection ---


def get_selection_fields(selection: Selection | None) -> set[str]:
    """Extract the set of field names requested in a GraphQL selection node."""
    if selection is None:
        return set()
    fields: set[str] = set()
    for sub in getattr(selection, "selections", []):
        if isinstance(sub, SelectedField):
            fields.add(sub.name)
    return fields


def get_entity_selection(selections: list[Selection] | Selection | None, entity_name: str) -> SelectedField | None:
    """Extract the SelectedField node corresponding to a specific entity name from a GraphQL selection.
    This is useful for determining which fields are requested for a specific entity in the query, especially when
    the same entity may be selected at multiple levels (e.g. "integration" at both top-level and inside a nested field).
    Returns the SelectedField node for the specified entity name, or None if not found.
    """
    if selections is None:
        return None

    if isinstance(selections, list):
        for selection in selections:
            if isinstance(selection, SelectedField) and selection.name == entity_name:
                return selection
            for sub in getattr(selection, "selections", []):
                if isinstance(sub, SelectedField) and sub.name == entity_name:
                    return sub
    else:
        if isinstance(selections, SelectedField) and selections.name == entity_name:
            return selections
        for sub in getattr(selections, "selections", []):
            if isinstance(sub, SelectedField) and sub.name == entity_name:
                return sub

    return None


def build_field_spec(selection: SelectedField | None) -> FieldSpec | None:
    """Convert a GraphQL SelectedField tree into a FieldSpec dict.

    Returns None when no fields are selected (meaning "load everything").
    Leaf fields map to None, nested selections map to a recursive FieldSpec.

    Example result: {"name": None, "children": {"id": None, "name": None}}
    """
    if selection is None:
        return None
    result: FieldSpec = {}
    for sub in getattr(selection, "selections", []):
        if isinstance(sub, SelectedField):
            sub_selections = getattr(sub, "selections", [])
            if sub_selections:
                result[sub.name] = build_field_spec(sub)
            else:
                result[sub.name] = None
    return result or None


# --- Sensitive value masking ---

MASKED_SECRET = "********"
ENCRYPTED_SECRET_PREFIX = "EncryptedSecretStr:"


def mask_sensitive_values(value: Any) -> Any:
    """Recursively mask encrypted secret payloads for API-safe responses."""
    if isinstance(value, dict):
        return {k: mask_sensitive_values(v) for k, v in value.items()}
    if isinstance(value, list):
        return [mask_sensitive_values(v) for v in value]
    if isinstance(value, tuple):
        return tuple(mask_sensitive_values(v) for v in value)
    if isinstance(value, EncryptedSecretStr):
        return MASKED_SECRET
    if isinstance(value, str) and value.startswith(ENCRYPTED_SECRET_PREFIX):
        return MASKED_SECRET
    return value


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
