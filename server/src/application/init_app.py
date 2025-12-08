import logging
from contextlib import asynccontextmanager
from typing import cast

from core.auth_providers.dependencies import get_auth_provider_service
from core.auth_providers.schema import AuthProviderCreate, GuestProviderConfig
from core.casbin.enforcer import CasbinEnforcer
from core.database import SessionLocal
from core.feature_flags.feature_flag_manager import reload_feature_flags_configs, init_feature_flags
from core.permissions.dependencies import get_permission_service
from core.permissions.schema import ActionLiteral, ApiPolicyCreate
from core.permissions.service import PermissionService
from core.users.dependencies import get_user_service
from core.users.model import UserDTO
from core.users.schema import UserCreateWithProvider
from core.utils.entities import get_all_entities, get_infra_entities

logger = logging.getLogger(__name__)


@asynccontextmanager
async def get_async_session():
    async with SessionLocal() as session:
        yield session


async def init_app():
    async with get_async_session() as session:
        user_service = get_user_service(session=session)
        auth_provider_service = get_auth_provider_service(session=session)
        permission_service = get_permission_service(session=session)
        guest_user = UserCreateWithProvider(
            email="guest_super@example.com",
            identifier="guest_super",
            first_name="Guest",
            last_name="User",
            provider="guest",
            display_name="Guest User (super)",
        )

        user = await user_service.create_user_if_not_exists(guest_user)
        if user.id is None:
            raise ValueError("Failed to create or retrieve the guest user.")

        providers = await auth_provider_service.count()
        if not providers:
            auth_provider = AuthProviderCreate(
                auth_provider="guest",
                name="Guest",
                enabled=True,
                filter_by_domain=["example.com"],
                configuration=GuestProviderConfig(
                    auth_provider="guest",
                ),
                description="Guest provider enabled by default to configure the system. "
                "Disable it after configuring the system.",
            )
            _ = await auth_provider_service.create(auth_provider, UserDTO.model_validate(user))
            await session.commit()

        await init_feature_flags(session=session)
        await reload_feature_flags_configs()

    enforcer = CasbinEnforcer()
    await enforcer.get_enforcer()
    assert enforcer.enforcer is not None, "Enforcer should not be None"

    await create_default_roles(permission_service, UserDTO.model_validate(user))
    await load_api_policies(permission_service, "default")
    await load_api_policies(permission_service, "infra")
    await create_super_policy(permission_service)
    await session.commit()

    await enforcer.enforcer.load_policy()


async def create_default_roles(permission_service: PermissionService, user: UserDTO):
    default_roles = ["default", "infra", "super"]
    for role in default_roles:
        existing_default_role = await permission_service.get_all_roles(filter={"v1": role})
        if not existing_default_role:
            await permission_service.create_role(role, user_id=user.id, reload_permission=False)


async def load_api_policies(permission_service: PermissionService, role_name: str):
    existing_permissions = await permission_service.get_role_api_permissions(role_name)
    apis = get_infra_entities() if role_name == "infra" else get_all_entities()
    apis += ["variable", "label", "tree", "schema"]

    entities_policies = {(role_name, f"api:{entity}", "read") for entity in apis}
    existing_policies = set((policy.v0, policy.v1, policy.v2) for policy in existing_permissions)

    policies_to_add = entities_policies.difference(existing_policies)

    for policy in policies_to_add:
        logger.debug("Adding policy:", policy)
        p = ApiPolicyCreate(
            role=role_name,
            api=policy[1].replace("api:", ""),
            action=cast(ActionLiteral, policy[2]),
        )
        await permission_service.create_api_policy(p, reload_permission=False)


async def create_super_policy(permission_service: PermissionService):
    existing_permissions = await permission_service.get_all(
        filter={"v0": "super", "ptype": "p", "v1": "*", "v2": "admin"}
    )
    if not existing_permissions:
        await permission_service.crud.create({"ptype": "p", "v0": "super", "v1": "*", "v2": "admin"})
