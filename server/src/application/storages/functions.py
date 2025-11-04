from application.storages.schema import GCPStorageConfig
from .model import AWSStorageConfig, AzureRMStorageConfig, Storage, StorageDTO


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
    else:
        raise NotImplementedError(f"{serialized_storage.storage_provider} storage provider is not supported")
