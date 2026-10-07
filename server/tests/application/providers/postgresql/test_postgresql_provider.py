from unittest.mock import AsyncMock, MagicMock, patch

import asyncpg
import pytest

from application.integrations.schema import PostgreSQLIntegrationConfig
from application.providers.postgresql.postgresql_provider import PostgresqlProvider, build_pg_conn_str
from application.providers.tf_storage_providers.postgresql_storage_provider import PostgresqlTfStorage
from application.storages.schema import PostgreSQLStorageConfig
from core.errors import CloudWrongCredentials

CONFIGURATION = {
    "pg_host": "db.example.com",
    "pg_port": 5433,
    "pg_database": "states",
    "pg_user": "ik user",
    "pg_password": "p@ss/w:rd",
    "pg_sslmode": "verify-full",
}


def test_postgresql_integration_config_secrets():
    config = PostgreSQLIntegrationConfig.model_validate(CONFIGURATION)
    secrets = config.get_secrets()
    assert [name for name, _ in secrets] == ["pg_password"]
    assert secrets[0][1].get_decrypted_value() == "p@ss/w:rd"


def test_build_pg_conn_str_quotes_credentials():
    config = PostgreSQLIntegrationConfig.model_validate(CONFIGURATION)
    assert (
        build_pg_conn_str(config)
        == "postgres://ik%20user:p%40ss%2Fw%3Ard@db.example.com:5433/states?sslmode=verify-full"
    )


async def test_postgresql_provider_authenticate_sets_environment():
    provider = PostgresqlProvider(configuration=CONFIGURATION, environment_variables={})
    await provider.authenticate()

    env = provider.environment_variables
    assert env["PGHOST"] == "db.example.com"
    assert env["PGPORT"] == "5433"
    assert env["PGDATABASE"] == "states"
    assert env["PGUSER"] == "ik user"
    assert env["PGPASSWORD"] == "p@ss/w:rd"
    assert env["PGSSLMODE"] == "verify-full"
    assert env["PG_CONN_STR"].startswith("postgres://ik%20user:")


async def test_postgresql_provider_is_valid_success():
    connection = AsyncMock()
    connection.fetchval.return_value = 1
    with patch("asyncpg.connect", AsyncMock(return_value=connection)):
        provider = PostgresqlProvider(configuration=CONFIGURATION, environment_variables={})
        assert await provider.is_valid() is True
    connection.close.assert_awaited_once()


async def test_postgresql_provider_is_valid_failure():
    with patch("asyncpg.connect", AsyncMock(side_effect=OSError("connection refused"))):
        provider = PostgresqlProvider(configuration=CONFIGURATION, environment_variables={})
        with pytest.raises(CloudWrongCredentials):
            _ = await provider.is_valid()


async def test_postgresql_provider_is_valid_without_database():
    connection = AsyncMock()
    connection.fetchval.return_value = 1
    connect = AsyncMock(side_effect=[asyncpg.InvalidCatalogNameError("missing"), connection])
    with patch("asyncpg.connect", connect):
        provider = PostgresqlProvider(configuration=CONFIGURATION, environment_variables={})
        assert await provider.is_valid() is True
    assert connect.await_args_list[1].kwargs["dsn"].split("?")[0].endswith("/postgres")


async def test_postgresql_provider_ensure_database_exists():
    connection = AsyncMock()
    with patch("asyncpg.connect", AsyncMock(return_value=connection)) as connect:
        provider = PostgresqlProvider(configuration=CONFIGURATION, environment_variables={})
        assert await provider.ensure_database() is False
    connect.assert_awaited_once()
    connection.execute.assert_not_awaited()


async def test_postgresql_provider_ensure_database_creates():
    maintenance = AsyncMock()
    connect = AsyncMock(side_effect=[asyncpg.InvalidCatalogNameError("missing"), maintenance])
    with patch("asyncpg.connect", connect):
        provider = PostgresqlProvider(configuration=CONFIGURATION, environment_variables={})
        assert await provider.ensure_database() is True
    maintenance.execute.assert_awaited_once_with('CREATE DATABASE "states"')
    maintenance.close.assert_awaited_once()


async def test_postgresql_provider_ensure_database_uses_maintenance_database():
    maintenance = AsyncMock()
    connect = AsyncMock(side_effect=[asyncpg.InvalidCatalogNameError("missing"), maintenance])
    with patch("asyncpg.connect", connect):
        provider = PostgresqlProvider(
            configuration={**CONFIGURATION, "pg_maintenance_database": "admin_db"}, environment_variables={}
        )
        assert await provider.ensure_database() is True
    assert connect.await_args_list[1].kwargs["dsn"].split("?")[0].endswith("/admin_db")


async def test_postgresql_provider_ensure_database_without_permission():
    maintenance = AsyncMock()
    maintenance.execute.side_effect = asyncpg.InsufficientPrivilegeError("denied")
    connect = AsyncMock(side_effect=[asyncpg.InvalidCatalogNameError("missing"), maintenance])
    with patch("asyncpg.connect", connect):
        provider = PostgresqlProvider(configuration=CONFIGURATION, environment_variables={})
        with pytest.raises(CloudWrongCredentials, match="no permission to create it"):
            _ = await provider.ensure_database()
    maintenance.close.assert_awaited_once()


async def test_postgresql_provider_ensure_database_unreachable():
    with patch("asyncpg.connect", AsyncMock(side_effect=OSError("connection refused"))):
        provider = PostgresqlProvider(configuration=CONFIGURATION, environment_variables={})
        with pytest.raises(CloudWrongCredentials, match="Cannot connect"):
            _ = await provider.ensure_database()


def make_tf_storage(schema_name: str = "ik_states") -> PostgresqlTfStorage:
    return PostgresqlTfStorage(
        logger=MagicMock(),
        configuration=PostgreSQLStorageConfig(pg_schema_name=schema_name),
        environment_variables={"PG_CONN_STR": "postgres://u:p@localhost:5432/db"},
    )


def test_postgresql_tf_storage_requires_connection():
    with pytest.raises(ValueError):
        _ = PostgresqlTfStorage(
            logger=MagicMock(),
            configuration=PostgreSQLStorageConfig(pg_schema_name="ik_states"),
            environment_variables={},
        )


async def test_postgresql_tf_storage_create():
    connection = AsyncMock()
    connection.fetchval.return_value = False
    with patch("asyncpg.connect", AsyncMock(return_value=connection)):
        await make_tf_storage().create()
    connection.execute.assert_awaited_once_with('CREATE SCHEMA IF NOT EXISTS "ik_states"')
    connection.close.assert_awaited_once()


async def test_postgresql_tf_storage_create_skips_existing_schema():
    connection = AsyncMock()
    connection.fetchval.return_value = True
    with patch("asyncpg.connect", AsyncMock(return_value=connection)):
        await make_tf_storage().create()
    connection.execute.assert_not_awaited()


async def test_postgresql_tf_storage_destroy():
    connection = AsyncMock()
    connection.fetchval.return_value = True
    with patch("asyncpg.connect", AsyncMock(return_value=connection)):
        await make_tf_storage().destroy()
    connection.execute.assert_awaited_once_with('DROP SCHEMA IF EXISTS "ik_states" CASCADE')
    connection.close.assert_awaited_once()


async def test_postgresql_tf_storage_destroy_skips_missing_schema():
    connection = AsyncMock()
    connection.fetchval.return_value = False
    with patch("asyncpg.connect", AsyncMock(return_value=connection)):
        await make_tf_storage().destroy()
    connection.execute.assert_not_awaited()


def test_postgresql_storage_config_rejects_invalid_schema_name():
    with pytest.raises(ValueError):
        _ = PostgreSQLStorageConfig(pg_schema_name='bad"; DROP SCHEMA public; --')
