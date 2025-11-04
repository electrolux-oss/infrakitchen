from typing import override
from google.cloud import storage
from application.storages.schema import GCPStorageConfig
from core import StorageProviderAdapter
from core.custom_entity_log_controller import EntityLogger
from google.oauth2 import service_account


class GcpStorage:
    environment_variables: dict[str, str]
    configuration: GCPStorageConfig

    def __init__(self, logger: EntityLogger, **kwargs) -> None:
        self.logger: EntityLogger = logger
        self.environment_variables = kwargs.get("environment_variables", {})
        configuration = kwargs.get("configuration")

        if not isinstance(configuration, GCPStorageConfig):
            raise ValueError("No configuration provided for GCP backend provider.")
        self.configuration = configuration

        if not self.configuration.gcp_bucket_name:
            raise ValueError("No bucket name provided for GCP backend provider.")

        self.credentials: service_account.Credentials = service_account.Credentials.from_service_account_file(
            self.environment_variables.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        )
        self.project_id: str = self.environment_variables.get("GOOGLE_PROJECT", "")
        if not self.project_id or not self.credentials:
            raise ValueError("No valid GCP project ID or credentials provided.")

        self.storage_client: storage.Client = storage.Client(credentials=self.credentials, project=self.project_id)

    async def _create_gcp_bucket(self):
        self.logger.info("Creating GCP bucket")
        buckets = self.storage_client.list_buckets()
        for bicket in buckets:
            if bicket.name == self.configuration.gcp_bucket_name:
                self.logger.info(
                    f"GCP bucket {self.configuration.gcp_bucket_name} already exists. Skipping creation..."
                )
                return
        self.logger.info(f"GCP bucket {self.configuration.gcp_bucket_name} not found. Creating...")
        bucket = self.storage_client.bucket(self.configuration.gcp_bucket_name)
        bucket.location = self.configuration.gcp_region
        try:
            bucket.create()
        except Exception as e:
            self.logger.error(f"Failed to create GCP bucket {self.configuration.gcp_bucket_name}: {e}")
            raise
        self.logger.info(
            f"Created GCP bucket {self.configuration.gcp_bucket_name} in region {self.configuration.gcp_region}"
        )

    async def _destroy_gcp_bucket(self):
        self.logger.info("Destroying GCP bucket")
        bucket = self.storage_client.bucket(self.configuration.gcp_bucket_name)
        if not bucket.exists():
            self.logger.info(f"GCP bucket {self.configuration.gcp_bucket_name} does not exist. Skipping destruction...")
            return
        self.logger.info(f"GCP bucket {self.configuration.gcp_bucket_name} found. Destroying...")
        bucket.delete(force=True)
        self.logger.info(f"Destroyed GCP bucket {self.configuration.gcp_bucket_name}")


class GcpTfStorage(StorageProviderAdapter, GcpStorage):
    __cloud_backend_provider_adapter_name__: str = "gcp"

    def __init__(self, logger: EntityLogger, **kwargs) -> None:
        super().__init__(logger, **kwargs)

    @override
    async def create(self) -> None:
        await self._create_gcp_bucket()

    @override
    async def destroy(self) -> None:
        await self._destroy_gcp_bucket()
