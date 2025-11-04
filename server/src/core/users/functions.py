from uuid import UUID

from core.casbin.enforcer import CasbinEnforcer


from ..users.model import UserDTO


async def user_has_access_to_resource(user: UserDTO | None, resource_id: str | UUID, action: str) -> bool:
    if user is None:
        return False

    user_id = user.id
    if user.primary_account:
        user_id = user.primary_account[0].id if user.primary_account else user.id

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    assert casbin_enforcer.enforcer is not None, "Casbin enforcer is not initialized"

    act_mapping = {
        "write": ["write", "admin"],
        "read": ["read", "write", "admin"],
        "admin": ["admin"],
    }

    for act in act_mapping[action]:
        if await casbin_enforcer.enforce_casbin_user(user_id, str(resource_id), act, object_type="resource") is True:
            return True

    return False


async def user_entity_permissions(user: UserDTO | None, entity_id: str | UUID) -> list[str]:
    if user is None:
        raise ValueError("User must not be None and must have an ID")

    user_id = user.id
    if user.primary_account:
        user_id = user.primary_account[0].id if user.primary_account else user.id

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    assert casbin_enforcer.enforcer is not None, "Casbin enforcer is not initialized"

    return await casbin_enforcer.list_user_permissions_for_entity(user_id, str(entity_id))


async def user_is_super_admin(user: UserDTO | None) -> bool:
    if user is None:
        return False

    user_id = user.id
    if user.primary_account:
        user_id = user.primary_account[0].id if user.primary_account else user.id

    casbin_enforcer = CasbinEnforcer()
    if casbin_enforcer.enforcer is None:
        _ = await casbin_enforcer.get_enforcer()
    assert casbin_enforcer.enforcer is not None, "Casbin enforcer is not initialized"
    requester_roles = await casbin_enforcer.get_user_roles(user_id)

    if "super" not in requester_roles:
        return False
    return True
