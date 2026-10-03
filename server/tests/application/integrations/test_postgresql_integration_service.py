from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from application.integrations.schema import PostgreSQLIntegrationConfig

CONFIGURATION = {
    "pg_host": "DB.example.com",
    "pg_port": 5432,
    "pg_database": "states",
    "pg_user": "ik",
    "pg_password": "secret",
}


def stored_integration(name: str, **overrides):
    return SimpleNamespace(
        name=name,
        configuration={**CONFIGURATION, "pg_host": "db.example.com", **overrides, "integration_provider": "postgresql"},
    )


async def test_ensure_postgresql_database_creates_database(mock_integration_service, mock_integration_crud):
    mock_integration_crud.get_all.return_value = [stored_integration("other", pg_database="other_states")]
    provider = AsyncMock()
    with patch("application.integrations.service.PostgresqlProvider", return_value=provider) as provider_cls:
        await mock_integration_service._ensure_postgresql_database(  # pyright: ignore[reportPrivateUsage]
            PostgreSQLIntegrationConfig.model_validate(CONFIGURATION)
        )
    provider_cls.assert_called_once()
    provider.ensure_database.assert_awaited_once()
    mock_integration_crud.get_all.assert_awaited_once_with(filter={"integration_provider": "postgresql"})


async def test_ensure_postgresql_database_rejects_database_of_other_integration(
    mock_integration_service, mock_integration_crud
):
    mock_integration_crud.get_all.return_value = [stored_integration("existing")]
    with (
        patch("application.integrations.service.PostgresqlProvider") as provider_cls,
        pytest.raises(ValueError, match="already used by integration existing"),
    ):
        await mock_integration_service._ensure_postgresql_database(  # pyright: ignore[reportPrivateUsage]
            PostgreSQLIntegrationConfig.model_validate(CONFIGURATION)
        )
    provider_cls.assert_not_called()


async def test_ensure_postgresql_database_ignores_other_providers(mock_integration_service, mock_integration_crud):
    await mock_integration_service._ensure_postgresql_database(None)  # pyright: ignore[reportPrivateUsage]
    mock_integration_crud.get_all.assert_not_awaited()


def test_postgresql_database_cannot_be_changed(mock_integration_service):
    existing = stored_integration("existing")
    config = PostgreSQLIntegrationConfig.model_validate({**CONFIGURATION, "pg_database": "new_states"})
    with pytest.raises(ValueError, match="cannot be changed"):
        mock_integration_service._validate_postgresql_database_unchanged(  # pyright: ignore[reportPrivateUsage]
            config, existing
        )


def test_postgresql_credentials_can_be_changed(mock_integration_service):
    existing = stored_integration("existing")
    config = PostgreSQLIntegrationConfig.model_validate({**CONFIGURATION, "pg_user": "other", "pg_password": "new"})
    mock_integration_service._validate_postgresql_database_unchanged(  # pyright: ignore[reportPrivateUsage]
        config, existing
    )
