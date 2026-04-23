import asyncio
from contextlib import asynccontextmanager


from core.config import setup_service_environment
from core.dependencies import get_async_session
from core.rabbitmq import RabbitMQConnection

from core.base_models import Base, MessageModel
from core.database import engine

from fixtures.auth_providers import create_auth_provider
from fixtures.integrations import insert_integrations
from fixtures.resources import insert_resources
from fixtures.source_code_and_version import insert_source_code_and_version
from fixtures.storages import insert_storages
from fixtures.templates import insert_template
from fixtures.users import create_user
from fixtures.validation_rules import insert_validation_rules


async def send_message(message: MessageModel, confirm: bool = False):
    pass


# Monkey patching the send_task method
RabbitMQConnection.send_message = send_message  # type: ignore[method-assign]


async def drop_all_tables(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def get_session():
    async with get_async_session() as session:
        yield session


async def create_fixtures():
    setup_service_environment()
    await drop_all_tables(engine)
    envs = ["dev", "staging", "prod"]
    async with get_session() as session:
        user = await create_user(session)
        await create_auth_provider(session, user)
        await insert_template(session, user)
        await insert_validation_rules(session, user)
        await session.commit()
        for env in envs:
            await insert_integrations(session, env, user)
            await insert_storages(session, env, user)

        await insert_source_code_and_version(session, user)
        for env in envs:
            await insert_resources(session, env, user)


if __name__ == "__main__":
    asyncio.run(create_fixtures())
