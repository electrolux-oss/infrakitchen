from datetime import datetime
from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.favorites.api import router
from application.favorites.dependencies import get_favorite_service
from application.favorites.model import FavoriteComponentType, FavoriteDTO


class MockFavoriteService:
    def __init__(self, favorites=None, created=None):
        self._favorites = favorites or []
        self._created = created
        self.deleted = []

    async def get_all_by_user_id(self, user_id):
        return self._favorites

    async def create(self, favorite, user_id):
        return self._created

    async def delete(self, user_id, component_type, component_id):
        self.deleted.append((user_id, component_type, component_id))


@pytest.fixture(autouse=True)
def app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def client_with_user(app):
    class MockUser:
        id = "user123"

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


@pytest.fixture
def override_service(app):
    def _override(service: MockFavoriteService):
        async def _get_service():
            return service

        app.dependency_overrides[get_favorite_service] = _get_service

    return _override


def _favorite_dto(
    component_type: FavoriteComponentType = "resource",
    component_id=None,
    user_id=None,
):
    return FavoriteDTO(
        user_id=user_id or uuid4(),
        component_type=component_type,
        component_id=component_id or uuid4(),
        created_at=datetime.now(),
    )


class TestGetAll:
    def test_forbidden(self, client_without_user):
        response = client_without_user.get("/favorites")
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_empty(self, client_with_user, override_service):
        override_service(MockFavoriteService(favorites=[]))

        response = client_with_user.get("/favorites")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []

    def test_with_items(self, client_with_user, override_service):
        favorites = [_favorite_dto(), _favorite_dto(component_type="executor")]
        override_service(MockFavoriteService(favorites=favorites))

        response = client_with_user.get("/favorites")

        assert response.status_code == HTTPStatus.OK
        assert len(response.json()) == 2
        assert response.json()[0]["component_type"] == favorites[0].component_type


class TestCreate:
    def test_forbidden(self, client_without_user):
        response = client_without_user.post(
            "/favorites",
            json={"component_type": "resource", "component_id": str(uuid4())},
        )

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_success(self, client_with_user, override_service):
        created = _favorite_dto()
        override_service(MockFavoriteService(created=created))

        response = client_with_user.post(
            "/favorites",
            json={"component_type": created.component_type, "component_id": str(created.component_id)},
        )

        assert response.status_code == HTTPStatus.CREATED
        assert response.json()["component_type"] == created.component_type


class TestDelete:
    def test_forbidden(self, client_without_user):
        response = client_without_user.delete(f"/favorites/resource/{uuid4()}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_success(self, client_with_user, override_service):
        service = MockFavoriteService()
        override_service(service)
        component_id = uuid4()

        response = client_with_user.delete(f"/favorites/resource/{component_id}")

        assert response.status_code == HTTPStatus.NO_CONTENT
        assert service.deleted == [("user123", "resource", component_id)]
