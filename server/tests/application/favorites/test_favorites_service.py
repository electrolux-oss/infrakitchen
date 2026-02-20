from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.favorites.model import Favorite, FavoriteComponentType, FavoriteCreate, FavoriteDTO
from application.favorites.service import FavoriteService
from core.errors import EntityNotFound


class FakeScalarResult:
    def __init__(self, scalars=None, scalar_one_or_none=None):
        self._scalars = scalars or []
        self._scalar_one_or_none = scalar_one_or_none

    def scalars(self):
        return self

    def all(self):
        return self._scalars

    def scalar_one_or_none(self):
        return self._scalar_one_or_none


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = Mock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    return session


@pytest.fixture
def favorite_service(mock_session):
    return FavoriteService(session=mock_session)


def _favorite(
    user_id=None,
    component_type: FavoriteComponentType = "resource",
    component_id=None,
):
    return Favorite(
        user_id=user_id or uuid4(),
        component_type=component_type,
        component_id=component_id or uuid4(),
        created_at=datetime.now(),
    )


class TestGetAllByUserId:
    @pytest.mark.asyncio
    async def test_empty(self, favorite_service, mock_session):
        mock_session.execute.return_value = FakeScalarResult(scalars=[])

        result = await favorite_service.get_all_by_user_id(user_id=uuid4())

        assert result == []
        mock_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_with_items(self, favorite_service, mock_session):
        favorites = [_favorite(), _favorite(component_type="executor")]
        mock_session.execute.return_value = FakeScalarResult(scalars=favorites)

        result = await favorite_service.get_all_by_user_id(user_id=uuid4())

        assert len(result) == 2
        assert isinstance(result[0], FavoriteDTO)
        assert result[0].component_type == favorites[0].component_type
        mock_session.execute.assert_awaited_once()


class TestCreate:
    @pytest.mark.asyncio
    async def test_existing_returns_existing(self, favorite_service, monkeypatch, mock_session):
        existing = _favorite()
        monkeypatch.setattr(favorite_service, "get_by_composite_keys", AsyncMock(return_value=existing))

        favorite_create = FavoriteCreate(component_type="resource", component_id=existing.component_id)
        result = await favorite_service.create(favorite=favorite_create, user_id=existing.user_id)

        assert result.user_id == existing.user_id
        assert result.component_id == existing.component_id
        mock_session.add.assert_not_called()
        mock_session.flush.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_new(self, favorite_service, monkeypatch, mock_session):
        monkeypatch.setattr(favorite_service, "get_by_composite_keys", AsyncMock(return_value=None))
        user_id = uuid4()
        component_id = uuid4()
        favorite_create = FavoriteCreate(component_type="resource", component_id=component_id)

        async def refresh_side_effect(obj):
            if obj.created_at is None:
                obj.created_at = datetime.now()

        mock_session.refresh.side_effect = refresh_side_effect

        result = await favorite_service.create(favorite=favorite_create, user_id=user_id)

        assert result.user_id == user_id
        assert result.component_id == component_id
        mock_session.add.assert_called_once()
        mock_session.flush.assert_awaited_once()
        mock_session.refresh.assert_awaited_once()


class TestDelete:
    @pytest.mark.asyncio
    async def test_not_found(self, favorite_service, monkeypatch, mock_session):
        monkeypatch.setattr(favorite_service, "get_by_composite_keys", AsyncMock(return_value=None))

        with pytest.raises(EntityNotFound):
            await favorite_service.delete(user_id=uuid4(), component_type="resource", component_id=uuid4())

        mock_session.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_success(self, favorite_service, monkeypatch, mock_session):
        existing = _favorite()
        monkeypatch.setattr(favorite_service, "get_by_composite_keys", AsyncMock(return_value=existing))

        await favorite_service.delete(
            user_id=existing.user_id,
            component_type=existing.component_type,
            component_id=existing.component_id,
        )

        mock_session.delete.assert_awaited_once_with(existing)


class TestGetByCompositeKeys:
    @pytest.mark.asyncio
    async def test_success(self, favorite_service, mock_session):
        favorite = _favorite()
        mock_session.execute.return_value = FakeScalarResult(scalar_one_or_none=favorite)

        result = await favorite_service.get_by_composite_keys(
            user_id=favorite.user_id,
            component_type=favorite.component_type,
            component_id=favorite.component_id,
        )

        assert result is favorite
        mock_session.execute.assert_awaited_once()


class TestDeleteAllByComponent:
    @pytest.mark.asyncio
    async def test_executes_delete(self, favorite_service, mock_session):
        await favorite_service.delete_all_by_component(component_type="resource", component_id=uuid4())

        mock_session.execute.assert_awaited_once()
