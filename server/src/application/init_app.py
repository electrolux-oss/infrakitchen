import json
import logging
import os
from contextlib import asynccontextmanager

from core.audit_logs.handler import AuditLogHandler
from core.auth_providers.crud import AuthProviderCRUD
from core.auth_providers.schema import AuthProviderCreate, GuestProviderConfig
from core.auth_providers.service import AuthProviderService
from core.casbin.enforcer import CasbinEnforcer
from core.database import SessionLocal
from core.feature_flags.feature_flag_manager import reload_feature_flags_configs, init_feature_flags
from core.users.crud import UserCRUD
from core.users.model import UserDTO
from core.users.schema import UserCreateWithProvider
from core.users.service import UserService
from core.utils.entities import get_all_entities, get_infra_entities
from core.utils.event_sender import EventSender

logger = logging.getLogger(__name__)


@asynccontextmanager
async def get_async_session():
    async with SessionLocal() as session:
        yield session


async def init_app():
    async with get_async_session() as session:
        user_service = UserService(
            crud=UserCRUD(session),
        )

        event_sender = EventSender(entity_name="auth_provider")
        audit_log_handler = AuditLogHandler(session=session, entity_name="auth_provider")
        auth_provider_service = AuthProviderService(
            crud=AuthProviderCRUD(session),
            event_sender=event_sender,
            audit_log_handler=audit_log_handler,
        )

        guest_user = UserCreateWithProvider(
            email="guest_super@example.com",
            identifier="guest_super",
            first_name="Guest",
            last_name="User",
            provider="guest",
            display_name="Guest User (super)",
        )

        user = await user_service.create_user_if_not_exists(guest_user)
        assert user.id is not None, "User ID should not be None"

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

    await load_entity_policies(enforcer, "default")
    await load_entity_policies(enforcer, "infra")
    await load_core_policies(enforcer)

    await enforcer.enforcer.load_policy()


async def load_entity_policies(enforcer, entity_type):
    existing_policies = await enforcer.get_all_policies(v0_value_to_filter=entity_type)
    entities = get_infra_entities() if entity_type == "infra" else get_all_entities()

    entities_policies = {(entity_type, f"api:{entity}s", "read") for entity in entities}
    policies_to_add = entities_policies.difference(existing_policies)

    for policy in policies_to_add:
        logger.debug("Adding policy:", policy)
        await enforcer.add_casbin_policy(
            subject=entity_type, object_id=policy[1], action="read", send_reload_event=False
        )


async def load_core_policies(enforcer):
    existing_policies = await enforcer.get_all_policies()
    core_policies = set()

    root_dir = os.path.dirname(os.path.realpath(__file__))

    policy_file_path = os.path.join(root_dir, "..", "core/casbin/core_policies.json")
    with open(policy_file_path) as json_policies_definition:
        policies_definition = json.load(json_policies_definition)
        for definition in policies_definition:
            subject = definition["subject"]
            object = definition["object"]
            action = definition["action"]
            object_type = definition.get("object_type")

            object_id = f"{object_type}:{object}" if object_type else object
            policy_definition = (subject, object_id, action)
            core_policies.add(policy_definition)

    policies_to_add = core_policies.difference(existing_policies)
    for policy in policies_to_add:
        logger.debug("Adding policy:", policy)
        await enforcer.add_casbin_policy(
            subject=policy[0], object_id=policy[1], action=policy[2], send_reload_event=False
        )
