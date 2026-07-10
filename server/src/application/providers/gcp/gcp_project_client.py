import json
from typing import Any

import google.auth
from google.cloud.resourcemanager_v3.services.projects import ProjectsAsyncClient
from google.cloud.resourcemanager_v3 import Project


def load_gcp_credentials_from_info(credentials_info: str) -> Any:
    parsed_credentials = json.loads(credentials_info)
    try:
        credentials, _ = google.auth.load_credentials_from_dict(parsed_credentials)
        return credentials
    except Exception as e:
        raise ValueError("Error loading GCP credentials.") from e


def load_gcp_credentials_from_file(credentials_path: str) -> Any:
    try:
        credentials, _ = google.auth.load_credentials_from_file(credentials_path)
        return credentials
    except json.JSONDecodeError as e:
        raise ValueError("Invalid GCP credentials provided. Credentials must be a valid JSON file.") from e
    except Exception as e:
        raise ValueError("Error loading GCP credentials.") from e


class GcpProjectClient:
    environment_variables: dict[str, str]

    def __init__(self, environment_variables: dict[str, str]) -> None:
        self.environment_variables = environment_variables
        self.credentials = load_gcp_credentials_from_file(
            self.environment_variables.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        )

        self.project_id: str = self.environment_variables.get("GOOGLE_PROJECT", "")
        if not self.project_id or not self.credentials:
            raise ValueError("No valid GCP project ID or credentials provided.")

        self.projects_client = ProjectsAsyncClient(credentials=self.credentials)

    async def get_project(self) -> Project:
        request = {"name": f"projects/{self.project_id}"}
        return await self.projects_client.get_project(request=request)
