from uuid import UUID

from core.casbin.enforcer import CasbinEnforcer
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
