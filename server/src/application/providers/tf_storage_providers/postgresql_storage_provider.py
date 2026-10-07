from typing import override

import asyncpg

from core import StorageProviderAdapter
from core.custom_entity_log_controller import EntityLogger

from ...storages.schema import PostgreSQLStorageConfig
from ..postgresql.postgresql_provider import quote_identifier


class PostgresqlStorage:
    environment_variables: dict[str, str]
    configuration: PostgreSQLStorageConfig

    def __init__(self, logger: EntityLogger, **kwargs) -> None:
        self.logger: EntityLogger = logger
        self.environment_variables = kwargs.get("environment_variables", {})
        configuration = kwargs.get("configuration")

        if not isinstance(configuration, PostgreSQLStorageConfig):
            raise ValueError("No configuration provided for PostgreSQL backend provider.")
        self.configuration = configuration

        if not self.configuration.pg_schema_name:
            raise ValueError("No schema name provided for PostgreSQL backend provider.")

        self.conn_str: str = self.environment_variables.get("PG_CONN_STR", "")
        if not self.conn_str:
            raise ValueError("No valid PostgreSQL connection provided.")

    async def _schema_exists(self, connection: asyncpg.Connection) -> bool:
        exists = await connection.fetchval(
            "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)",
            self.configuration.pg_schema_name,
        )
        return bool(exists)

    async def _create_pg_schema(self):
        schema_name = self.configuration.pg_schema_name
        self.logger.info("Creating PostgreSQL schema")
        connection = await asyncpg.connect(dsn=self.conn_str, timeout=10)
        try:
            if await self._schema_exists(connection):
                self.logger.info(f"PostgreSQL schema {schema_name} already exists. Skipping creation...")
                return
            self.logger.info(f"PostgreSQL schema {schema_name} not found. Creating...")
            _ = await connection.execute(f"CREATE SCHEMA IF NOT EXISTS {quote_identifier(schema_name)}")
            self.logger.info(f"Created PostgreSQL schema {schema_name}")
        finally:
            await connection.close()

    async def _destroy_pg_schema(self):
        schema_name = self.configuration.pg_schema_name
        self.logger.info("Destroying PostgreSQL schema")
        connection = await asyncpg.connect(dsn=self.conn_str, timeout=10)
        try:
            if not await self._schema_exists(connection):
                self.logger.info(f"PostgreSQL schema {schema_name} does not exist. Skipping destruction...")
                return
            self.logger.info(f"PostgreSQL schema {schema_name} found. Destroying...")
            _ = await connection.execute(f"DROP SCHEMA IF EXISTS {quote_identifier(schema_name)} CASCADE")
            self.logger.info(f"Destroyed PostgreSQL schema {schema_name}")
        finally:
            await connection.close()


class PostgresqlTfStorage(StorageProviderAdapter, PostgresqlStorage):
    __cloud_backend_provider_adapter_name__: str = "postgresql"

    def __init__(self, logger: EntityLogger, **kwargs) -> None:
        super().__init__(logger, **kwargs)

    @override
    async def create(self) -> None:
        await self._create_pg_schema()

    @override
    async def destroy(self) -> None:
        await self._destroy_pg_schema()
