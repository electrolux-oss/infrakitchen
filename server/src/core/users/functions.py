from typing import Any
from uuid import UUID

from casbin.util.builtin_operators import key_match

from core.casbin.enforcer import CasbinEnforcer
from core.constants.model import ModelActions
from core.errors import AccessDenied


from ..users.model import UserDTO


async def user_has_access_to_entity(
    user: UserDTO | None, entity_id: str | UUID, action: str, entity_name: str | None = "resource"
) -> bool:
    if user is None:
        return False

    user_id = user.id
    if user.primary_account:
        user_id = user.primary_account[0].id if user.primary_account else user.id
    if user.deactivated is True:
        raise AccessDenied("User account is deactivated")
    if user.primary_account:
        if user.primary_account[0].deactivated is True:
            raise AccessDenied("Primary account is deactivated")

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()

    if casbin_enforcer.enforcer is None:
        raise RuntimeError("Casbin enforcer is not initialized")

    act_mapping = {
        "write": ["write", "admin"],
        "read": ["read", "write", "admin"],
        "admin": ["admin"],
    }

    for act in act_mapping[action]:
        if casbin_enforcer.enforcer.enforce(f"user:{user_id}", f"{entity_name}:{entity_id}", act) is True:
            return True

    return False


async def user_has_access_to_api(user: UserDTO | None, api: str, action: str) -> bool:
    if user is None:
        return False

    user_id = user.id
    if user.primary_account:
        user_id = user.primary_account[0].id if user.primary_account else user.id
    if user.deactivated is True:
        raise AccessDenied("User account is deactivated")
    if user.primary_account:
        if user.primary_account[0].deactivated is True:
            raise AccessDenied("Primary account is deactivated")

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()

    if casbin_enforcer.enforcer is None:
        raise RuntimeError("Casbin enforcer is not initialized")

    act_mapping = {
        "write": ["write", "admin"],
        "read": ["read", "write", "admin"],
        "admin": ["admin"],
    }

    for act in act_mapping[action]:
        if casbin_enforcer.enforcer.enforce(f"user:{user_id}", f"api:{api}", act) is True:
            return True

    return False


async def user_apis_permissions(user: UserDTO | None) -> dict[str, str]:
    def filter_policies(policies: list[list[str]]) -> dict[str, str]:
        filtered: dict[str, str] = {}
        for policy in policies:
            action = policy[2]
            entity = policy[1]
            if filtered.get(entity) is None:
                filtered[entity] = action
            else:
                # Keep the highest permission level
                if action == "admin":
                    filtered[entity] = "admin"
                    continue

                if filtered[entity] == "admin":
                    continue

                if action == "write":
                    filtered[entity] = action
                    continue

                if filtered[entity] != "read" and action == "read":
                    continue
                filtered[entity] = action
        return filtered

    if user is None:
        raise ValueError("User must not be None and must have an ID")

    user_id = user.id
    if user.primary_account:
        user_id = user.primary_account[0].id if user.primary_account else user.id
    if user.deactivated is True:
        raise AccessDenied("User account is deactivated")
    if user.primary_account:
        if user.primary_account[0].deactivated is True:
            raise AccessDenied("Primary account is deactivated")

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    if not casbin_enforcer.enforcer:
        raise RuntimeError("Casbin enforcer is not initialized")
    policies = await casbin_enforcer.enforcer.get_implicit_permissions_for_user(f"user:{user_id}")
    return filter_policies(policies)


async def user_api_permission(user: UserDTO | None, api: str) -> dict[str, str] | None:
    apis_permissions = await user_apis_permissions(user)
    if apis_permissions.get("*") == "admin":
        # User has super admin access
        return {f"api:{api}": "admin"}

    if apis_permissions.get(f"api:{api}") is not None:
        return {f"api:{api}": apis_permissions[f"api:{api}"]}
    return None


async def user_entity_permissions(user: UserDTO | None, entity_id: str | UUID, entity_name: str) -> list[str]:
    if user is None:
        raise ValueError("User must not be None and must have an ID")

    user_id = user.id
    if user.primary_account:
        user_id = user.primary_account[0].id if user.primary_account else user.id
    if user.deactivated is True:
        raise AccessDenied("User account is deactivated")
    if user.primary_account:
        if user.primary_account[0].deactivated is True:
            raise AccessDenied("Primary account is deactivated")

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    if casbin_enforcer.enforcer is None:
        raise RuntimeError("Casbin enforcer is not initialized")

    if casbin_enforcer.enforcer.enforce(f"user:{user_id}", f"{entity_name}:{entity_id}", "admin") is True:
        return ["read", "write", "admin"]

    if casbin_enforcer.enforcer.enforce(f"user:{user_id}", f"{entity_name}:{entity_id}", "write") is True:
        return ["read", "write"]

    if casbin_enforcer.enforcer.enforce(f"user:{user_id}", f"{entity_name}:{entity_id}", "read") is True:
        return ["read"]

    return []


async def user_is_super_admin(user: UserDTO | None) -> bool:
    if user is None:
        return False

    user_id = user.id
    if user.primary_account:
        user_id = user.primary_account[0].id if user.primary_account else user.id
    if user.deactivated is True:
        raise AccessDenied("User account is deactivated")
    if user.primary_account:
        if user.primary_account[0].deactivated is True:
            raise AccessDenied("Primary account is deactivated")

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    if casbin_enforcer.enforcer is None:
        raise RuntimeError("Casbin enforcer is not initialized")

    requester_roles = await casbin_enforcer.get_user_roles(user_id)

    if "super" not in requester_roles:
        return False
    return True


async def _get_casbin_enforcer():
    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    if casbin_enforcer.enforcer is None:
        raise RuntimeError("Casbin enforcer is not initialized")
    return casbin_enforcer.enforcer


def _expand_subjects_to_user_ids(enforcer: Any, subjects: set[str]) -> set[str]:
    """Resolve policy subjects (``user:<id>`` or role names, possibly nested) to user IDs."""
    user_ids: set[str] = set()
    visited_roles: set[str] = set()
    pending = list(subjects)
    while pending:
        subject = pending.pop()
        if subject.startswith("user:"):
            user_ids.add(subject.removeprefix("user:"))
            continue
        if subject in visited_roles:
            continue
        visited_roles.add(subject)
        pending.extend(member for member, *_ in enforcer.get_filtered_named_grouping_policy("g", 1, subject))
    return user_ids


async def get_entity_admin_user_ids(entities: list[tuple[str, str | UUID]]) -> set[str]:
    """IDs of users holding ``admin`` on any of the given ``(entity_name, entity_id)`` pairs.

    The global ``*`` (super admin) policy is ignored, so super admins are only included
    when they were granted admin on the entity itself.
    """
    enforcer = await _get_casbin_enforcer()
    objects = [f"{entity_name}:{entity_id}" for entity_name, entity_id in entities]
    subjects = {
        subject
        for subject, policy_object, *_ in enforcer.get_filtered_policy(2, "admin")
        if policy_object != "*" and any(key_match(obj, policy_object) for obj in objects)
    }
    return _expand_subjects_to_user_ids(enforcer, subjects)


async def get_super_admin_user_ids() -> set[str]:
    enforcer = await _get_casbin_enforcer()
    return _expand_subjects_to_user_ids(enforcer, {"super"})


async def get_user_actions(requester: UserDTO | None) -> list[str]:
    if await user_is_super_admin(requester) is False:
        return []
    return [ModelActions.EDIT, ModelActions.DELETE]
