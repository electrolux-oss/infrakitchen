import asyncio
from contextlib import asynccontextmanager
import logging
import os
import sys
from unittest.mock import AsyncMock, MagicMock

from alembic.command import upgrade
from alembic.config import Config


from application.projects.dependencies import get_project_service
from core.casbin.enforcer import CasbinEnforcer
from core.config import setup_service_environment
from core.dependencies import get_async_session
from core.rabbitmq import RabbitMQConnection

from core.base_models import Base, MessageModel
from core.database import engine

from fixtures.auth_providers import create_auth_provider
from fixtures.batch_operations import insert_batch_operations
from fixtures.executors import insert_executors
from fixtures.insert_secrets import insert_secrets
from fixtures.integrations import insert_env_integrations, insert_integrations
from fixtures.resources import insert_resources

from fixtures.source_code import insert_source_code
from fixtures.source_code_and_version import insert_source_code_version
from fixtures.storages import insert_storages
from fixtures.templates import insert_templates
from fixtures.users import create_guest_super_user, create_regular_user
from fixtures.validation_rules import insert_validation_rules

logger = logging.getLogger("alembic")


async def send_message(message: MessageModel, confirm: bool = False):
    pass


# Monkey patching the send_task method
RabbitMQConnection.send_message = send_message  # type: ignore[method-assign]

# Mock the CasbinEnforcer to bypass validation during fixture creation
_mock_enforcer = MagicMock()
_mock_enforcer.enforce = MagicMock(return_value=True)
_mock_enforcer.load_policy = AsyncMock()
_mock_enforcer.get_implicit_permissions_for_user = AsyncMock(return_value=[])
_mock_enforcer.get_filtered_named_grouping_policy = MagicMock(return_value=[])
_casbin_instance = CasbinEnforcer()
_casbin_instance.enforcer = _mock_enforcer  # type: ignore[assignment]
CasbinEnforcer.get_enforcer = AsyncMock(return_value=_mock_enforcer)  # type: ignore[method-assign]


def run_sql_migrations():
    # retrieves the directory that *this* file is in
    root_dir = os.path.dirname(os.path.realpath(__file__))
    # this assumes the alembic.ini is also contained in this same directory
    config_file = os.path.join(root_dir, "../alembic.ini")

    config = Config(file_=config_file)
    config.set_main_option("script_location", f"{root_dir}/../alembic")

    # upgrade the database to the latest revision
    upgrade(config, "head")


async def drop_all_tables(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def get_session():
    async with get_async_session() as session:
        yield session


async def create_fixtures(drop_tables: bool = False):
    setup_service_environment()
    if drop_tables:
        logger.warning("Dropping all tables and recreating fixtures...")
        await drop_all_tables(engine)
    envs = ["dev", "staging", "prod"]
    async with get_session() as session:
        project_service = get_project_service(session=session)
        if await project_service.count() != 0:
            logger.warning(
                "Fixtures already exist. Skipping fixture creation. "
                "Use --drop-tables to drop existing tables and recreate fixtures."
            )
            return

        logger.info("Creating fixtures...")
        user = await create_guest_super_user(session)
        await create_auth_provider(session, user)
        await create_regular_user(session, user)
        await insert_integrations(session, user)
        await insert_source_code(session, user)
        await insert_templates(session, user)
        await insert_source_code_version(session, user)
        await insert_validation_rules(session, user)
        for env in envs:
            await insert_env_integrations(session, env, user)
            await insert_storages(session, env, user)
            await insert_secrets(session, [env], user)

        await insert_executors(session, user)
        await insert_resources(session, envs, user)
        await insert_batch_operations(session, envs, user)
        logger.info("Fixtures created successfully.")


if __name__ == "__main__":
    run_sql_migrations()
    asyncio.run(create_fixtures(drop_tables="--drop-tables" in sys.argv))
