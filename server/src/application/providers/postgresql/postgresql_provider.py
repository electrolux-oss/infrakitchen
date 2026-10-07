import logging
from typing import override
from urllib.parse import quote

import asyncpg

from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from ...integrations.schema import PostgreSQLIntegrationConfig

log = logging.getLogger("postgresql_provider")


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def build_pg_conn_str(configuration: PostgreSQLIntegrationConfig, database: str | None = None) -> str:
    """Build a postgres:// URL (used as PG_CONN_STR by the tofu/terraform pg backend)."""
    user = quote(configuration.pg_user, safe="")
    password = quote(configuration.pg_password.get_decrypted_value(), safe="")
    database = quote(database or configuration.pg_database, safe="")
    return (
        f"postgres://{user}:{password}@{configuration.pg_host}:{configuration.pg_port}/{database}"
        f"?sslmode={configuration.pg_sslmode}"
    )


class PostgresqlAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None = None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log

        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for PostgresqlAuthentication")
        self.configuration: PostgreSQLIntegrationConfig = PostgreSQLIntegrationConfig.model_validate(config)
        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})

    async def authenticate_postgresql(self) -> None:
        configuration = self.configuration
        if not (configuration.pg_host and configuration.pg_database and configuration.pg_user):
            self.logger.error("No valid authentication method provided for PostgreSQL.")
            raise CloudWrongCredentials("No valid authentication method provided for PostgreSQL.")

        self.logger.info("Authenticating with PostgreSQL...")
        # standard libpq variables, used by the pg backend and the postgresql provider
        self.environment_variables["PGHOST"] = configuration.pg_host
        self.environment_variables["PGPORT"] = str(configuration.pg_port)
        self.environment_variables["PGDATABASE"] = configuration.pg_database
        self.environment_variables["PGUSER"] = configuration.pg_user
        self.environment_variables["PGPASSWORD"] = configuration.pg_password.get_decrypted_value()
        self.environment_variables["PGSSLMODE"] = configuration.pg_sslmode
        self.environment_variables["PG_CONN_STR"] = build_pg_conn_str(configuration)


class PostgresqlProvider(IntegrationProvider, PostgresqlAuthentication):
    __integration_provider_name__: str = "postgresql"
    __integration_provider_type__: str = "cloud"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_postgresql()

    async def _connect(self, database: str | None = None) -> asyncpg.Connection:
        return await asyncpg.connect(dsn=build_pg_conn_str(self.configuration, database), timeout=10)

    @override
    async def is_valid(self) -> bool:
        try:
            try:
                connection = await self._connect()
            except asyncpg.InvalidCatalogNameError:
                # the integration database is created later, credentials are checked on the server
                connection = await self._connect(self.configuration.pg_maintenance_database)
        except Exception as e:
            raise CloudWrongCredentials(
                "PostgreSQL credentials are invalid.", metadata=[{"cloud_message": str(e)}]
            ) from e
        try:
            return await connection.fetchval("SELECT 1") == 1
        finally:
            await connection.close()

    async def ensure_database(self) -> bool:
        """Create the integration database if it does not exist, returns True when it was created."""
        database = self.configuration.pg_database
        try:
            connection = await self._connect()
            await connection.close()
            self.logger.info(f"PostgreSQL database {database} already exists")
            return False
        except asyncpg.InvalidCatalogNameError:
            self.logger.info(f"PostgreSQL database {database} not found. Creating...")
        except Exception as e:
            raise CloudWrongCredentials(
                f"Cannot connect to PostgreSQL database {database}", metadata=[{"cloud_message": str(e)}]
            ) from e

        maintenance_database = self.configuration.pg_maintenance_database
        try:
            connection = await self._connect(maintenance_database)
        except Exception as e:
            raise CloudWrongCredentials(
                f"PostgreSQL database {database} does not exist and the {maintenance_database} database "
                "is not reachable to create it",
                metadata=[{"cloud_message": str(e)}],
            ) from e
        try:
            _ = await connection.execute(f"CREATE DATABASE {quote_identifier(database)}")
        except asyncpg.DuplicateDatabaseError:
            return False
        except asyncpg.InsufficientPrivilegeError as e:
            raise CloudWrongCredentials(
                f"PostgreSQL database {database} does not exist and user {self.configuration.pg_user} "
                "has no permission to create it (CREATEDB)",
                metadata=[{"cloud_message": str(e)}],
            ) from e
        finally:
            await connection.close()
        self.logger.info(f"Created PostgreSQL database {database}")
        return True
