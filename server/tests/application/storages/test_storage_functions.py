from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from application.storages.functions import (
    get_tf_storage_config,
    get_tf_storage_environment,
    get_tf_workspace,
    tf_workspace_name,
)
from core.errors import CannotProceed


def make_storage(
    storage_provider: str, configuration: dict[str, Any], integration_provider: str, integration_config: dict[str, Any]
):
    user_id = uuid4()
    integration_id = uuid4()
    return SimpleNamespace(
        id=uuid4(),
        created_by=user_id,
        name="storage",
        storage_type="tofu",
        storage_provider=storage_provider,
        integration_id=integration_id,
        integration={
            "id": integration_id,
            "created_by": user_id,
            "name": "integration",
            "integration_type": "cloud",
            "integration_provider": integration_provider,
            "configuration": {**integration_config, "integration_provider": integration_provider},
        },
        configuration={**configuration, "storage_provider": storage_provider},
    )


PG_INTEGRATION = {
    "pg_host": "localhost",
    "pg_database": "states",
    "pg_user": "ik",
    "pg_password": "secret",
}
AWS_INTEGRATION = {
    "aws_account": "123456789012",
    "aws_access_key_id": "key",
    "aws_secret_access_key": "secret",
}


@pytest.mark.parametrize(
    "path,expected",
    [
        ("service-catalog/vpc/main/terraform.tfstate", "service-catalog__vpc__main"),
        ("/team/app.tfstate", "team__app"),
        ("my path/with.dots", "my_path__with_dots"),
        ("terraform.tfstate", "default"),
    ],
)
def test_tf_workspace_name(path, expected):
    assert tf_workspace_name(path) == expected


def test_get_tf_storage_config_postgresql_has_no_secrets():
    storage = make_storage("postgresql", {"pg_schema_name": "ik_states"}, "postgresql", PG_INTEGRATION)
    config = get_tf_storage_config(storage, "a/b/terraform.tfstate")  # pyright: ignore[reportArgumentType]
    assert config == 'schema_name = "ik_states"\n'


def test_get_tf_storage_environment_postgresql():
    storage = make_storage("postgresql", {"pg_schema_name": "ik_states"}, "postgresql", PG_INTEGRATION)
    env = get_tf_storage_environment(storage)  # pyright: ignore[reportArgumentType]
    assert env == {"PG_CONN_STR": "postgres://ik:secret@localhost:5432/states?sslmode=require"}
    assert get_tf_workspace(storage, "a/b/terraform.tfstate") == "a__b"  # pyright: ignore[reportArgumentType]


def test_get_tf_storage_environment_postgresql_requires_postgresql_integration():
    storage = make_storage("postgresql", {"pg_schema_name": "ik_states"}, "aws", AWS_INTEGRATION)
    with pytest.raises(CannotProceed):
        _ = get_tf_storage_environment(storage)  # pyright: ignore[reportArgumentType]


def test_get_tf_storage_environment_other_providers_are_empty():
    storage = make_storage("aws", {"aws_bucket_name": "bucket", "aws_region": "us-east-1"}, "aws", AWS_INTEGRATION)
    assert get_tf_storage_environment(storage) == {}  # pyright: ignore[reportArgumentType]
    assert get_tf_workspace(storage, "a/b/terraform.tfstate") is None  # pyright: ignore[reportArgumentType]
