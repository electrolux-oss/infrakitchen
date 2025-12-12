from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.source_codes.api import router
from application.source_codes.dependencies import get_source_code_service
from application.source_codes.schema import SourceCodeResponse
from core.constants.model import ModelActions

SOURCE_CODE_ID = "1985435id-1234-5678-90ab-cdef12345678"


class MockSourceCodesService:
    def __init__(self, return_value=None, items=None, actions=None, total=0):
        self._return_value = return_value
        self._items = items or []
        self._total = total
        self._actions = actions or []

    async def get_by_id(self, source_code_id):
        return self._return_value

    async def get_all(self, *args, **kwargs):
        return self._items

    async def count(self, filter=None):
        return self._total

    async def create(self, *args, **kwargs):
        return self._return_value

    async def update(self, *args, **kwargs):
        return self._return_value

    async def patch(self, *args, **kwargs):
        return self._return_value

    async def delete(self, *args, **kwargs):
        pass

    async def get_actions(self, *args, **kwargs):
        return self._actions


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
    def _override(service: MockSourceCodesService):
        async def _get_service():
            return service

        app.dependency_overrides[get_source_code_service] = _get_service

    return _override


@pytest.fixture
def client_with_user(app):
    class MockUser:
        id = uuid4()

    user = MockUser()

    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = user
        return await call_next(request)

    return TestClient(app)


@pytest.fixture
def client_without_user(app):
    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = None
        return await call_next(request)

    return TestClient(app)


class TestGetById:
    def test_get_by_id_success(self, client, override_service, mocked_source_code_response):
        service = MockSourceCodesService(return_value=mocked_source_code_response)
        override_service(service)

        response = client.get(f"/source_codes/{SOURCE_CODE_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(mocked_source_code_response.id)
        assert json_response["creator"]["id"] == str(mocked_source_code_response.creator.id)

    def test_get_by_id_not_found(self, client, override_service):
        service = MockSourceCodesService(return_value=None)
        override_service(service)

        response = client.get("/source_codes/invalid_id")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "SourceCode not found"}


class TestGetAll:
    def test_get_all_success(self, client, override_service, mocked_source_code_response):
        total_source_codes = 5

        source_code_response_array = [
            SourceCodeResponse(
                id=uuid4(),
                labels=["label1", "label2"],
                creator=mocked_source_code_response.creator,
                source_code_provider="github",
                source_code_language="opentofu",
                source_code_url="source_code_url",
                integration=mocked_source_code_response.integration,
            ),
            SourceCodeResponse(
                id=uuid4(),
                labels=["label3", "label4"],
                creator=mocked_source_code_response.creator,
                source_code_provider="github",
                source_code_language="opentofu",
                source_code_url="source_code_url",
                integration=mocked_source_code_response.integration,
            ),
        ]

        service = MockSourceCodesService(total=total_source_codes, items=source_code_response_array)
        override_service(service)
        response = client.get("/source_codes")

        assert response.status_code == HTTPStatus.OK
        assert (
            response.headers["Content-Range"]
            == f"source_codes 0-{len(source_code_response_array)}/{total_source_codes}"
        )

    def test_get_all_empty(self, client, override_service):
        service = MockSourceCodesService(total=0, items=[])
        override_service(service)

        response = client.get("/source_codes")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "source_codes 0-0/0"


class TestCreate:
    def test_create_success(self, client_with_user, override_service, mocked_source_code_response):
        service = MockSourceCodesService(return_value=mocked_source_code_response)
        override_service(service)

        source_code_create_body = {
            "description": "test_source_code",
            "source_code_url": "source_code_url",
            "source_code_provider": "github",
            "source_code_language": "opentofu",
            "integration_id": str(mocked_source_code_response.integration.id),
            "labels": ["label1", "label2"],
        }

        response = client_with_user.post("/source_codes", json=source_code_create_body)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["id"] == str(mocked_source_code_response.id)
        assert json_response["creator"]["id"] == str(mocked_source_code_response.creator.id)

    @pytest.mark.parametrize(
        "client_fixture,expected_status,expected_response",
        [
            ("client_without_user", HTTPStatus.FORBIDDEN, {"detail": "Access denied"}),
        ],
    )
    def test_create_access_control(
        self, request, mocked_source_code_response, client_fixture, expected_status, expected_response
    ):
        client = request.getfixturevalue(client_fixture)
        source_code_create_body = {
            "description": "test_source_code",
            "source_code_url": "source_code_url",
            "source_code_provider": "github",
            "source_code_language": "opentofu",
            "integration_id": str(mocked_source_code_response.integration.id),
            "labels": ["label1", "label2"],
        }

        response = client.post("/source_codes", json=source_code_create_body)

        assert response.status_code == expected_status
        assert response.json() == expected_response


class TestUpdate:
    def test_update_success(
        self,
        client_with_user,
        override_service,
        mocked_source_code_response,
    ):
        integration_id = str(mocked_source_code_response.integration.id)
        source_code_update_body = {
            "description": "updated_description",
            "integration_id": integration_id,
            "labels": [],
        }

        updated_source_code_response = mocked_source_code_response
        updated_source_code_response.description = source_code_update_body["description"]
        updated_source_code_response.labels = source_code_update_body["labels"]

        service = MockSourceCodesService(return_value=updated_source_code_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/source_codes/{SOURCE_CODE_ID}", json=source_code_update_body)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(mocked_source_code_response.id)
        assert json_response["description"] == source_code_update_body["description"]
        assert json_response["labels"] == source_code_update_body["labels"]

    def test_update_forbidden(
        self,
        client_with_user,
        mocked_source_code_response,
        override_service,
    ):
        integration_id = str(mocked_source_code_response.integration.id)
        source_code_update_body = {
            "description": "updated_description",
            "integration_id": integration_id,
            "labels": [],
        }

        service = MockSourceCodesService(return_value=None, actions=[])
        override_service(service)

        response = client_with_user.patch(f"/source_codes/{SOURCE_CODE_ID}", json=source_code_update_body)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}


class TestPatchAction:
    def test_patch_action_success(
        self,
        client_with_user,
        override_service,
        mocked_source_code_response,
    ):
        source_code_patch = {"action": ModelActions.DELETE}
        override_service(
            MockSourceCodesService(return_value=mocked_source_code_response, actions=[ModelActions.DELETE])
        )

        response = client_with_user.patch(f"/source_codes/{SOURCE_CODE_ID}/actions", json=source_code_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_action_forbidden(
        self,
        client_with_user,
        override_service,
    ):
        source_code_patch = {"action": ModelActions.DELETE}
        override_service(MockSourceCodesService(return_value=None, actions=[]))

        response = client_with_user.patch(f"/source_codes/{SOURCE_CODE_ID}/actions", json=source_code_patch)
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action delete"}

    def test_patch_action_invalid_action(
        self,
        client_with_user,
        override_service,
    ):
        source_code_patch = {"action": "invalid_action"}
        override_service(MockSourceCodesService(return_value=None, actions=[]))

        response = client_with_user.patch(f"/source_codes/{SOURCE_CODE_ID}/actions", json=source_code_patch)
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}


class TestDelete:
    def test_delete_success(
        self,
        client_with_user,
        override_service,
    ):
        override_service(MockSourceCodesService(actions=[ModelActions.DELETE]))

        response = client_with_user.delete(f"/source_codes/{SOURCE_CODE_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT
        assert response.content == b""

    def test_delete_forbidden(
        self,
        client_with_user,
        override_service,
    ):
        override_service(MockSourceCodesService(actions=[]))

        response = client_with_user.delete(f"/source_codes/{SOURCE_CODE_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action delete"}


class TestGetActions:
    def test_get_actions_success(
        self,
        client_with_user,
        override_service,
    ):
        override_service(MockSourceCodesService(actions=["read", "write", "admin"]))

        response = client_with_user.get(f"/source_codes/{SOURCE_CODE_ID}/actions")
        assert response.status_code == HTTPStatus.OK
        assert response.json() == ["read", "write", "admin"]
