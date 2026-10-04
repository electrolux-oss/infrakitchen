import re

from application.integrations.schema import PostgreSQLIntegrationConfig
from application.providers.postgresql import build_pg_conn_str
from application.storages.schema import (
    AWSStorageConfig,
    AzureRMStorageConfig,
    GCPStorageConfig,
    PostgreSQLStorageConfig,
)
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.errors import CannotProceed
from core.users.functions import user_api_permission
from core.users.model import UserDTO

from .model import Storage, StorageDTO


def get_tf_storage_config(storage: Storage, tf_state_path: str) -> str:
    serialized_storage = StorageDTO(**storage.__dict__)
    backend_config = ""
    if isinstance(serialized_storage.configuration, AWSStorageConfig):
        backend_config += f'bucket = "{serialized_storage.configuration.aws_bucket_name}"\n'
        backend_config += f'region = "{serialized_storage.configuration.aws_region}"\n'
        backend_config += "use_lockfile = true\n"
        backend_config += f'key = "{tf_state_path}"\n'
        backend_config += "encrypt = true\n"
        return backend_config
    elif isinstance(serialized_storage.configuration, AzureRMStorageConfig):
        backend_config += f'resource_group_name = "{serialized_storage.configuration.azurerm_resource_group_name}"\n'
        backend_config += f'storage_account_name = "{serialized_storage.configuration.azurerm_storage_account_name}"\n'
        backend_config += f'container_name = "{serialized_storage.configuration.azurerm_container_name}"\n'
        backend_config += f'key = "{tf_state_path}"\n'
        return backend_config
    elif isinstance(serialized_storage.configuration, GCPStorageConfig):
        backend_config += f'bucket = "{serialized_storage.configuration.gcp_bucket_name}"\n'
        backend_config += f'prefix = "{tf_state_path}"\n'
        return backend_config
    elif isinstance(serialized_storage.configuration, PostgreSQLStorageConfig):
        # connection string is passed via PG_CONN_STR (see get_tf_storage_environment), never written to the file
        backend_config += f'schema_name = "{serialized_storage.configuration.pg_schema_name}"\n'
        return backend_config
    else:
        raise NotImplementedError(f"{serialized_storage.storage_provider} storage provider is not supported")


def tf_workspace_name(tf_state_path: str) -> str:
    """
    Workspace name for backends keyed by workspace instead of a state path (pg).
    Must stay deterministic, a changed name points the resource to an empty state.
    """
    path = re.sub(r"(^|/)terraform\.tfstate$", "", tf_state_path.strip().strip("/"))
    path = re.sub(r"\.tfstate$", "", path)
    path = path.replace("/", "__")
    return re.sub(r"[^A-Za-z0-9_-]", "_", path) or "default"


def get_tf_storage_environment(storage: Storage) -> dict[str, str]:
    """Environment variables required by the backend, kept out of backend.tfvars because they contain secrets."""
    serialized_storage = StorageDTO(**storage.__dict__)
    if isinstance(serialized_storage.configuration, PostgreSQLStorageConfig):
        integration_config = serialized_storage.integration.configuration
        if not isinstance(integration_config, PostgreSQLIntegrationConfig):
            raise CannotProceed("PostgreSQL storage requires a PostgreSQL integration")
        return {"PG_CONN_STR": build_pg_conn_str(integration_config)}
    return {}


def get_tf_workspace(storage: Storage, tf_state_path: str) -> str | None:
    """Workspace to run in, None keeps the default one (backends with a state path)."""
    if storage.storage_provider == "postgresql":
        return tf_workspace_name(tf_state_path)
    return None


async def get_storage_actions(requester: UserDTO, status: ModelStatus, state: ModelState) -> list[str]:
    """Get all actions available for a storage based on user permissions and storage status/state."""
    apis = await user_api_permission(requester, "storage")
    if not apis:
        return []
    requester_permissions = [apis["api:storage"]]

    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status in [ModelStatus.IN_PROGRESS]:
        return []

    user_is_admin = "admin" in requester_permissions

    if status == ModelStatus.QUEUED:
        if user_is_admin:
            actions.append(ModelActions.RETRY)
        return actions

    if state == ModelState.PROVISIONED:
        actions.append(ModelActions.DESTROY)
        actions.append(ModelActions.EXECUTE)
        actions.append(ModelActions.EDIT)

    elif state == ModelState.PROVISION:
        actions.append(ModelActions.EXECUTE)
        actions.append(ModelActions.EDIT)
        if status == ModelStatus.READY or status == ModelStatus.ERROR:
            actions.append(ModelActions.DELETE)
    elif state == ModelState.DESTROYED:
        if status == ModelStatus.DONE:
            actions.append(ModelActions.RECREATE)
            if user_is_admin:
                actions.append(ModelActions.DELETE)

    elif state == ModelState.DESTROY:
        if status == ModelStatus.ERROR or status == ModelStatus.READY:
            actions.append(ModelActions.RECREATE)
            actions.append(ModelActions.EXECUTE)

    return actions
