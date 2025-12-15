from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.source_code_versions.api import router
from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.schema import SourceCodeVersionResponse, SourceConfigUpdate
from core.constants.model import ModelActions


class MockSourceCodeVersionsService:
    def __init__(self, return_value=None, items=None, actions=None, total=0):
        self._return_value = return_value
        self._items = items or []
        self._total = total
        self._actions = actions or []

    async def get_by_id(self, source_code_version_id: str):
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

    async def get_configs_by_scv_id(self, source_code_version_id: str):
        return self._return_value

    async def get_config_by_id(self, config_id: str):
        return self._return_value

    async def update_config(self, config_id: str, config: SourceConfigUpdate):
        return self._return_value

    async def update_configs(self, source_code_version_id: str, configs):
        return self._return_value

    async def get_output_configs_by_scv_id(self, source_code_version_id: str):
        return self._return_value


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
    def _override(service: MockSourceCodeVersionsService):
        async def _get_service():
            return service

        app.dependency_overrides[get_source_code_version_service] = _get_service

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
    def test_get_by_id_success(self, client, override_service, mocked_source_code_versions_response):
        mock_service = MockSourceCodeVersionsService(return_value=mocked_source_code_versions_response)
        override_service(mock_service)

        response = client.get(f"/source_code_versions/{mocked_source_code_versions_response.id}")
        json_response = response.json()

        assert response.status_code == 200
        assert json_response["id"] == str(mocked_source_code_versions_response.id)
        assert json_response["labels"] == mocked_source_code_versions_response.labels

    def test_get_by_id_not_found(self, client, override_service):
        mock_service = MockSourceCodeVersionsService(return_value=None)
        override_service(mock_service)

        response = client.get("/source_code_versions/invalid_id-id")
        assert response.status_code == 404
        assert response.json() == {"detail": "SourceCodeVersion not found"}


class TestGetAll:
    def test_get_all_success(self, client, override_service, mocked_source_code_versions_response):
        total_source_code_versions = 5

        source_code_versions_response_array = [
            SourceCodeVersionResponse(
                id=uuid4(),
                labels=["label1", "label2"],
                creator=mocked_source_code_versions_response.creator,
                template=mocked_source_code_versions_response.template,
                source_code=mocked_source_code_versions_response.source_code,
            ),
            SourceCodeVersionResponse(
                id=uuid4(),
                labels=["label3", "label4"],
                creator=mocked_source_code_versions_response.creator,
                template=mocked_source_code_versions_response.template,
                source_code=mocked_source_code_versions_response.source_code,
            ),
        ]

        service = MockSourceCodeVersionsService(
            total=total_source_code_versions, items=source_code_versions_response_array
        )
        override_service(service)

        response = client.get("/source_code_versions")
        assert response.status_code == HTTPStatus.OK
        assert (
            response.headers["Content-Range"]
            == f"source_code_versions 0-{len(source_code_versions_response_array)}/{total_source_code_versions}"
        )

    def test_get_all_empty(self, client, override_service):
        service = MockSourceCodeVersionsService(total=0, items=[])
        override_service(service)

        response = client.get("/source_code_versions")
        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "source_code_versions 0-0/0"


class TestCreate:
    def test_create_success(self, client_with_user, override_service, mocked_source_code_versions_response):
        service = MockSourceCodeVersionsService(return_value=mocked_source_code_versions_response)
        override_service(service)

        source_code_version_body = {
            "source_code_id": str(mocked_source_code_versions_response.source_code.id),
            "template_id": str(mocked_source_code_versions_response.template.id),
            "source_code_folder": "source_code_folder/test_folder",
            "source_code_version": "v1.0.0",
            "labels": ["label1", "label2"],
        }

        response = client_with_user.post(
            "/source_code_versions",
            json=source_code_version_body,
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["id"] == str(mocked_source_code_versions_response.id)
        assert json_response["source_code_folder"] == source_code_version_body["source_code_folder"]

    def test_create_forbidden(self, client_without_user):
        source_code_version_body = {
            "source_code_id": str(uuid4()),
            "template_id": str(uuid4()),
            "source_code_folder": "source_code_folder/test_folder",
            "source_code_version": "v1.0.0",
            "labels": ["label1", "label2"],
        }

        response = client_without_user.post(
            "/source_code_versions",
            json=source_code_version_body,
        )
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}


class TestUpdate:
    def test_update_success(self, client_with_user, override_service, mocked_source_code_versions_response):
        service = MockSourceCodeVersionsService(
            return_value=mocked_source_code_versions_response, actions=[ModelActions.EDIT]
        )
        override_service(service)

        source_code_version_id = str(mocked_source_code_versions_response.id)
        source_code_version_update_body = {
            "source_code_folder": "updated_folder",
            "source_code_version": "v1.0.1",
            "labels": ["updated_label"],
        }

        response = client_with_user.patch(
            f"/source_code_versions/{source_code_version_id}",
            json=source_code_version_update_body,
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(mocked_source_code_versions_response.id)
        assert json_response["source_code_folder"] == mocked_source_code_versions_response.source_code_folder

    def test_update_forbidden(self, client_without_user, override_service):
        source_code_version_id = str(uuid4())
        source_code_version_update_body = {
            "source_code_folder": "updated_folder",
            "source_code_version": "v1.0.1",
            "labels": ["updated_label"],
        }
        override_service(MockSourceCodeVersionsService(return_value=None, actions=[]))

        response = client_without_user.patch(
            f"/source_code_versions/{source_code_version_id}",
            json=source_code_version_update_body,
        )
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}


class TestPatchAction:
    def test_patch_action_success(self, client_with_user, override_service, mocked_source_code_versions_response):
        source_code_version_patch = {"action": ModelActions.DELETE}

        override_service(
            MockSourceCodeVersionsService(
                return_value=mocked_source_code_versions_response, actions=[ModelActions.DELETE]
            )
        )

        response = client_with_user.patch(
            f"/source_code_versions/{mocked_source_code_versions_response.id}/actions", json=source_code_version_patch
        )
        assert response.status_code == HTTPStatus.OK

    def test_patch_action_forbidden(self, client_without_user, override_service):
        source_code_version_id = str(uuid4())
        source_code_version_patch = {"action": ModelActions.DELETE}
        override_service(MockSourceCodeVersionsService(return_value=None, actions=[]))

        response = client_without_user.patch(
            f"/source_code_versions/{source_code_version_id}/actions", json=source_code_version_patch
        )
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action delete"}

    def test_patch_action_invalid_action(self, client_with_user, override_service):
        source_code_version_patch = {"action": "invalid_action"}

        override_service(MockSourceCodeVersionsService(return_value=None, actions=[]))

        response = client_with_user.patch(
            f"/source_code_versions/{str(uuid4())}/actions", json=source_code_version_patch
        )
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}


class TestDelete:
    def test_delete_success(self, client_with_user, override_service):
        override_service(MockSourceCodeVersionsService(actions=[ModelActions.DELETE]))

        response = client_with_user.delete(f"/source_code_versions/{str(uuid4())}")

        assert response.status_code == HTTPStatus.NO_CONTENT
        assert response.content == b""

    def test_delete_forbidden(self, client_with_user, override_service):
        override_service(MockSourceCodeVersionsService(actions=[]))

        response = client_with_user.delete(f"/source_code_versions/{str(uuid4())}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action delete"}


class TestGetActions:
    def test_get_actions_success(self, client_with_user, override_service):
        override_service(MockSourceCodeVersionsService(actions=["read", "write", "admin"]))

        response = client_with_user.get(f"/source_code_versions/{str(uuid4())}/actions")
        assert response.status_code == HTTPStatus.OK
        assert response.json() == ["read", "write", "admin"]


class TestGetConfigs:
    def test_get_configs_success(self, client_with_user, override_service, mocked_source_config_response):
        override_service(MockSourceCodeVersionsService(return_value=[mocked_source_config_response]))

        response = client_with_user.get(f"/source_code_versions/{str(mocked_source_config_response.id)}/configs")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0]["id"] == str(mocked_source_config_response.id)
        assert json_response[0]["name"] == mocked_source_config_response.name


class TestGetConfigById:
    def test_get_config_by_id_success(self, client_with_user, override_service, mocked_source_config_response):
        override_service(MockSourceCodeVersionsService(return_value=mocked_source_config_response))

        source_code_version_id = uuid4()
        response = client_with_user.get(
            f"/source_code_versions/{source_code_version_id}/configs/{str(mocked_source_config_response.id)}"
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(mocked_source_config_response.id)
        assert json_response["name"] == mocked_source_config_response.name

    def test_get_config_by_id_not_found(self, client_with_user, override_service):
        override_service(MockSourceCodeVersionsService(return_value=None))

        response = client_with_user.get(f"/source_code_versions/{str(uuid4())}/configs/{str(uuid4())}")
        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "Config not found"}


class TestUpdateConfigById:
    def test_update_config_by_id_success(self, client_with_user, override_service, mocked_source_config_response):
        source_config_update_body = {
            "required": True,
        }

        updated_source_config_response = mocked_source_config_response
        updated_source_config_response.required = source_config_update_body["required"]

        override_service(
            MockSourceCodeVersionsService(return_value=updated_source_config_response, actions=[ModelActions.EDIT])
        )

        source_code_version_id = uuid4()
        response = client_with_user.put(
            f"/source_code_versions/{source_code_version_id}/configs/{str(updated_source_config_response.id)}",
            json=source_config_update_body,
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(updated_source_config_response.id)
        assert json_response["name"] == mocked_source_config_response.name
        assert json_response["required"] == updated_source_config_response.required

    def test_update_config_by_id_user_forbidden(self, client_without_user, override_service):
        override_service(MockSourceCodeVersionsService(return_value=None, actions=[]))
        response = client_without_user.put(f"/source_code_versions/{str(uuid4())}/configs/{str(uuid4())}", json={})
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}


class TestUpdateConfigs:
    def test_update_configs_success(self, client_with_user, override_service, mocked_source_config_response):
        # Create a list of updated configs
        config_updates = [
            {
                "id": str(mocked_source_config_response.id),
                "required": True,
                "default": "updated_value",
                "frozen": False,
            }
        ]

        updated_configs = [mocked_source_config_response]
        override_service(MockSourceCodeVersionsService(return_value=updated_configs, actions=[ModelActions.EDIT]))

        source_code_version_id = uuid4()
        response = client_with_user.put(
            f"/source_code_versions/{source_code_version_id}/configs",
            json=config_updates,
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert isinstance(json_response, list)
        assert len(json_response) == 1
        assert json_response[0]["id"] == str(mocked_source_config_response.id)
        assert json_response[0]["name"] == mocked_source_config_response.name

    def test_update_configs_multiple_success(self, client_with_user, override_service, mocked_source_config_response):
        second_config = mocked_source_config_response
        second_config.id = uuid4()
        second_config.name = "second_config"

        config_updates = [
            {
                "id": str(mocked_source_config_response.id),
                "required": True,
                "default": "first_value",
            },
            {
                "id": str(second_config.id),
                "required": False,
                "default": "second_value",
            },
        ]

        updated_configs = [mocked_source_config_response, second_config]
        override_service(MockSourceCodeVersionsService(return_value=updated_configs, actions=[ModelActions.EDIT]))

        source_code_version_id = uuid4()
        response = client_with_user.put(
            f"/source_code_versions/{source_code_version_id}/configs",
            json=config_updates,
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert isinstance(json_response, list)
        assert len(json_response) == 2
        assert json_response[0]["id"] == str(mocked_source_config_response.id)
        assert json_response[1]["id"] == str(second_config.id)

    def test_update_configs_empty_list(self, client_with_user, override_service):
        config_updates = []
        override_service(MockSourceCodeVersionsService(return_value=[], actions=[ModelActions.EDIT]))

        source_code_version_id = uuid4()
        response = client_with_user.put(
            f"/source_code_versions/{source_code_version_id}/configs",
            json=config_updates,
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []

    def test_update_configs_user_forbidden(self, client_without_user, override_service):
        override_service(MockSourceCodeVersionsService(return_value=None, actions=[]))

        config_updates = [
            {
                "id": str(uuid4()),
                "required": True,
            }
        ]

        response = client_without_user.put(
            f"/source_code_versions/{str(uuid4())}/configs",
            json=config_updates,
        )
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}

    def test_update_configs_access_denied(self, client_with_user, override_service):
        override_service(MockSourceCodeVersionsService(return_value=[], actions=[]))

        config_updates = [
            {
                "id": str(uuid4()),
                "required": True,
            }
        ]

        source_code_version_id = uuid4()
        response = client_with_user.put(
            f"/source_code_versions/{source_code_version_id}/configs",
            json=config_updates,
        )
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}


class TestGetOutputs:
    def test_get_outputs_success(
        self,
        client_with_user,
        override_service,
        mocked_source_output_configs_response,
    ):
        override_service(MockSourceCodeVersionsService(return_value=[mocked_source_output_configs_response]))

        response = client_with_user.get(
            f"/source_code_versions/{str(mocked_source_output_configs_response.id)}/outputs"
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0]["id"] == str(mocked_source_output_configs_response.id)
        assert json_response[0]["name"] == mocked_source_output_configs_response.name
