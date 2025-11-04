from google.cloud.resourcemanager_v3 import ProjectsClient, Project
from google.oauth2 import service_account


class GcpProjectClient:
    environment_variables: dict[str, str]

    def __init__(self, environment_variables: dict[str, str]) -> None:
        self.environment_variables = environment_variables
        self.credentials: service_account.Credentials = service_account.Credentials.from_service_account_file(
            self.environment_variables.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        )
        self.project_id: str = self.environment_variables.get("GOOGLE_PROJECT", "")
        if not self.project_id or not self.credentials:
            raise ValueError("No valid GCP project ID or credentials provided.")

        self.projects_client = ProjectsClient(credentials=self.credentials)

    async def get_project(self) -> Project:
        return self.projects_client.get_project(name=f"projects/{self.project_id}")
