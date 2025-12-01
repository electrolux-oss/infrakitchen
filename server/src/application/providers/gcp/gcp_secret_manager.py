from json import JSONDecodeError
from google.cloud.secretmanager import (
    AccessSecretVersionRequest,
    AccessSecretVersionResponse,
    SecretManagerServiceClient,
)
from google.oauth2 import service_account

from application.providers.gcp.gcp_project_client import GcpProjectClient


class GcpSecretManager:
    environment_variables: dict[str, str]

    def __init__(self, environment_variables: dict[str, str], region: str | None) -> None:
        self.environment_variables = environment_variables
        try:
            self.credentials: service_account.Credentials = service_account.Credentials.from_service_account_file(
                self.environment_variables.get("GOOGLE_APPLICATION_CREDENTIALS", "")
            )
        except JSONDecodeError as e:
            raise ValueError("Invalid GCP credentials provided. Credentials must be a valid JSON file.") from e
        except Exception as e:
            raise ValueError("Error loading GCP credentials.") from e

        self.project_id: str = self.environment_variables.get("GOOGLE_PROJECT", "")
        if not self.project_id or not self.credentials:
            raise ValueError("No valid GCP project ID or credentials provided.")

        if region:
            # Create the Secret Manager client with the regional endpoint
            api_endpoint = f"secretmanager.{region}.rep.googleapis.com"
            self.sm_client = SecretManagerServiceClient(
                client_options={"api_endpoint": api_endpoint}, credentials=self.credentials
            )
        else:
            self.sm_client = SecretManagerServiceClient(credentials=self.credentials)

        self.project_client = GcpProjectClient(environment_variables=self.environment_variables)

    async def get_secret(self, secret_name: str, region: str | None) -> AccessSecretVersionResponse:
        project = await self.project_client.get_project()
        if region:
            name = f"{project.name}/locations/{region}/secrets/{secret_name}/versions/latest"
        else:
            name = f"{project.name}/secrets/{secret_name}/versions/latest"

        request = AccessSecretVersionRequest(
            name=name,
        )
        return self.sm_client.access_secret_version(request=request)
