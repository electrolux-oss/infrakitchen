from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.resources.dependencies import get_resource_service
from application.views.resource_variables_view import router

SOURCE_CODE_VERSION_ID = str(uuid4())


class MockResourceService:
    def __init__(self, variables_schema=None):
        self._variables_schema = variables_schema if variables_schema is not None else []

    async def get_variable_schema(self, source_code_version_id: str, parent_resources: list[str] | None):
        return self._variables_schema


@pytest.fixture
def app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def override_service(app):
    def _override(service: MockResourceService):
        app.dependency_overrides[get_resource_service] = lambda: service

    return _override


mocked_variables_schema = [
    {
        "description": "Test variable1",
        "frozen": False,
        "index": 0,
        "name": "k8s_namespace_cloud_test_var",
        "options": [],
        "required": True,
        "restricted": False,
        "sensitive": False,
        "type": "array[string]",
        "unique": False,
        "value": ["test"],
    }
]


class TestGetResourceVariablesSchema:
    def test_get_with_multiple_parents_ids_separated_with_comma_success(self, client, override_service):
        override_service(MockResourceService(variables_schema=mocked_variables_schema))
        parent_resources_ids = "parent1_id, parent2_id"

        response = client.get(
            f"/source_code_versions/{SOURCE_CODE_VERSION_ID}/variables",
            params={"parent_resources": parent_resources_ids},
        )

        assert response.status_code == HTTPStatus.OK
        assert response.json() == mocked_variables_schema

    def test_get_with_one_parent_id_success(self, client, override_service):
        override_service(MockResourceService(variables_schema=mocked_variables_schema))
        parent_resources_ids = "parent1_id"

        response = client.get(
            f"/source_code_versions/{SOURCE_CODE_VERSION_ID}/variables",
            params={"parent_resources": parent_resources_ids},
        )

        assert response.status_code == HTTPStatus.OK
        assert response.json() == mocked_variables_schema

    def test_get_with_multiple_parents_ids_as_array_success(self, client, override_service):
        override_service(MockResourceService(variables_schema=mocked_variables_schema))
        parent_resources_ids = "parent1_id, parent2_id"

        response = client.get(
            f"/source_code_versions/{SOURCE_CODE_VERSION_ID}/variables?parent_resources=[{parent_resources_ids}]",
        )
        assert response.status_code == HTTPStatus.OK
        assert response.json() == mocked_variables_schema

    def test_get_with_empty_parent_list_return_empty(self, client, override_service):
        override_service(MockResourceService(variables_schema=[]))

        response = client.get(
            f"/source_code_versions/{SOURCE_CODE_VERSION_ID}/variables", params={"parent_resources": ""}
        )

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []

    def test_get_with_empty_parent_list_as_string_return_empty(self, client, override_service):
        override_service(MockResourceService(variables_schema=[]))

        response = client.get(f'/source_code_versions/{SOURCE_CODE_VERSION_ID}/variables?parent_resources="[]"')  # noqa: E501

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []

    def test_get_with_empty_parent_list_not_provided_return_unprocessable_content(self, client, override_service):
        override_service(MockResourceService(variables_schema=[]))

        response = client.get(f"/source_code_versions/{SOURCE_CODE_VERSION_ID}/variables")

        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
