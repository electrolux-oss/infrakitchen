from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from application.resource_temp_state.api import router
from application.resource_temp_state.dependencies import get_resource_temp_state_service

RESOURCE_TEMP_STATE_ID = str(uuid4())
RESOURCE_ID = str(uuid4())


class MockResourceTempStateService:
    def __init__(self, by_id=None, by_resource_id=None):
        self._by_id = by_id
        self._by_resource_id = by_resource_id
        self.delete_called_with = None

    async def get_by_id(self, id: str):
        return self._by_id

    async def get_by_resource_id(self, resource_id: str):
        return self._by_resource_id

    async def delete_by_resource_id(self, resource_id: str):
        if resource_id == "invalid-uuid":
            raise HTTPException(status_code=404, detail="ResourceTempState not found")
        self.delete_called_with = resource_id


@pytest.fixture(autouse=True)
def app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def override_service(app):
    def _override(service: MockResourceTempStateService):
        async def _get_service():
            return service

        app.dependency_overrides[get_resource_temp_state_service] = _get_service

    return _override


class TestGetById:
    def test_get_by_id_success(self, client, override_service, mocked_resource_temp_state_response):
        service = MockResourceTempStateService(by_id=mocked_resource_temp_state_response)
        override_service(service)

        response = client.get(f"/resource_temp_states/{RESOURCE_TEMP_STATE_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(mocked_resource_temp_state_response.id)
        assert json_response["resource_id"] == str(mocked_resource_temp_state_response.resource_id)
        assert json_response["value"] == mocked_resource_temp_state_response.value

    def test_get_by_id_not_found(self, client, override_service):
        service = MockResourceTempStateService(by_id=None)
        override_service(service)

        response = client.get(f"/resource_temp_states/{RESOURCE_TEMP_STATE_ID}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "ResourceTempState not found"}

    def test_get_by_id_invalid_uuid(self, client, override_service):
        service = MockResourceTempStateService(by_id=None)
        override_service(service)

        response = client.get("/resource_temp_states/invalid-uuid")

        assert response.status_code == 404
        assert "detail" in response.json()


class TestGetByResourceId:
    def test_get_by_resource_id_success(self, client, override_service, mocked_resource_temp_state_response):
        service = MockResourceTempStateService(by_resource_id=mocked_resource_temp_state_response)
        override_service(service)

        response = client.get(f"/resource_temp_states/resource/{RESOURCE_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(mocked_resource_temp_state_response.id)
        assert json_response["resource_id"] == str(mocked_resource_temp_state_response.resource_id)
        assert json_response["value"] == mocked_resource_temp_state_response.value

    def test_get_by_resource_id_not_found(self, client, override_service):
        service = MockResourceTempStateService(by_resource_id=None)
        override_service(service)

        response = client.get(f"/resource_temp_states/resource/{RESOURCE_ID}")

        assert response.status_code == 404
        assert response.json()["detail"] == "ResourceTempState not found"

    def test_get_by_resource_id_invalid_uuid(self, client, override_service):
        service = MockResourceTempStateService(by_resource_id=None)
        override_service(service)

        response = client.get("/resource_temp_states/resource/invalid-uuid")
        assert response.status_code == 404
        assert "detail" in response.json()


class TestDeleteByResourceId:
    def test_delete_by_resource_id_success(self, client, override_service):
        service = MockResourceTempStateService()
        override_service(service)

        response = client.delete(f"/resource_temp_states/resource/{RESOURCE_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT
        assert getattr(service, "delete_called_with", None) == RESOURCE_ID

    def test_delete_by_resource_id_invalid_uuid(self, client, override_service):
        service = MockResourceTempStateService()
        override_service(service)

        response = client.delete("/resource_temp_states/resource/invalid-uuid")

        assert response.status_code == HTTPStatus.NOT_FOUND
        body = response.json()
        assert body["detail"] == "ResourceTempState not found"
