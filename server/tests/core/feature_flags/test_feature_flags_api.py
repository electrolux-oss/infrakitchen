from http import HTTPStatus
from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.feature_flags.api import router
from core.feature_flags.dependencies import get_feature_flag_service
from core.feature_flags.enforcer import FeatureFlagEnforcer
from core.feature_flags.model import FeatureFlagDTO


class MockFeatureFlagService:
    def __init__(self, flags=None, updated_flag=None):
        self._flags = flags or []
        self._updated_flag = updated_flag

    async def get_all(self):
        return self._flags

    async def update_config(self, feature_flag, user=None):
        return self._updated_flag or feature_flag


@pytest.fixture(autouse=True)
def app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client_with_user(app, mocked_user_response):
    user = mocked_user_response

    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = user
        return await call_next(request)

    return TestClient(app)


@pytest.fixture
def override_service(app):
    def _override(service: MockFeatureFlagService):
        async def _get_service():
            return service

        app.dependency_overrides[get_feature_flag_service] = _get_service

    return _override


def set_user_is_admin(monkeypatch, is_admin=True):
    async def mock_user_is_super_admin(user_id: str) -> bool:
        return is_admin

    monkeypatch.setattr("core.feature_flags.api.user_is_super_admin", mock_user_is_super_admin)


@pytest.fixture(autouse=True)
def cleanup_feature_flag_enforcer_as_singleton():
    if hasattr(FeatureFlagEnforcer, "_instances"):
        FeatureFlagEnforcer._instances.clear()


@pytest.fixture
def mock_rabbitmq_setup(monkeypatch):
    def _setup():
        if hasattr(FeatureFlagEnforcer, "_instances"):
            FeatureFlagEnforcer._instances.clear()

        mock_rabbitmq = MagicMock()
        mock_rabbitmq.send_task = AsyncMock()

        def mock_enforcer_init(self, rabbitmq=None):
            self.rabbitmq = mock_rabbitmq

        async def mock_send_reload_configs_event(self):
            await self.rabbitmq.send_task(MagicMock())

        monkeypatch.setattr(FeatureFlagEnforcer, "__init__", mock_enforcer_init)
        monkeypatch.setattr(FeatureFlagEnforcer, "send_reload_configs_event", mock_send_reload_configs_event)

        return mock_rabbitmq

    return _setup


class TestFeatureFlagsAPI:
    def test_get_feature_flags_success(self, client_with_user, override_service, monkeypatch):
        flags = [
            FeatureFlagDTO(name="Approval flow", enabled=True),
            FeatureFlagDTO(name="Second Feature Flag", enabled=False),
        ]
        service = MockFeatureFlagService(flags=flags)
        override_service(service)

        set_user_is_admin(monkeypatch)

        response = client_with_user.get("/feature_flags")
        assert response.status_code == HTTPStatus.OK
        assert response.json()["status"] == "ok"
        assert response.json()["data"] == [flag.model_dump() for flag in flags]

    def test_get_feature_flags_forbidden(self, client_with_user, override_service, monkeypatch):
        service = MockFeatureFlagService(flags=[])
        override_service(service)

        set_user_is_admin(monkeypatch, is_admin=False)

        response = client_with_user.get("/feature_flags")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Access denied"

    def test_patch_feature_flag_success(
        self, client_with_user, override_service, monkeypatch, mock_rabbitmq_setup, mocked_user
    ):
        flag = FeatureFlagDTO(name="approval_flow", enabled=True)
        updated_flag = FeatureFlagDTO(name="approval_flow", enabled=False)
        service = MockFeatureFlagService(updated_flag=updated_flag)
        override_service(service)

        set_user_is_admin(monkeypatch)
        mock_rabbitmq = mock_rabbitmq_setup()

        response = client_with_user.patch("/feature_flags", json=flag.model_dump())

        assert response.status_code == HTTPStatus.OK
        assert response.json() == updated_flag.model_dump()
        mock_rabbitmq.send_task.assert_called_once()

    def test_patch_feature_flag_forbidden(self, client_with_user, override_service, monkeypatch):
        flag = FeatureFlagDTO(name="flag1", enabled=True)
        service = MockFeatureFlagService()
        override_service(service)

        set_user_is_admin(monkeypatch, is_admin=False)

        response = client_with_user.patch("/feature_flags", json=flag.model_dump())
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Access denied"

    def test_reload_feature_flags_success(self, client_with_user, monkeypatch, mock_rabbitmq_setup):
        set_user_is_admin(monkeypatch)
        mock_rabbitmq = mock_rabbitmq_setup()

        response = client_with_user.post("/feature_flags/reload")

        assert response.status_code == HTTPStatus.OK
        assert response.json() is None
        mock_rabbitmq.send_task.assert_called_once()

    def test_reload_feature_flags_forbidden(self, client_with_user, monkeypatch):
        set_user_is_admin(monkeypatch, is_admin=False)

        response = client_with_user.post("/feature_flags/reload")
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Access denied"
