from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.favorites.crud import FavoriteCRUD
from application.favorites.model import Favorite, FavoriteDTO
from application.favorites.service import FavoriteService


@pytest.fixture
def mock_favorite_crud():
    crud = Mock(spec=FavoriteCRUD)
    crud.session = Mock()
    crud.get_by_id = AsyncMock()
    crud.get_all_by_user_id = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.delete = AsyncMock()
    crud.delete_all_by_component = AsyncMock()
    crud.refresh = AsyncMock()
    return crud


@pytest.fixture
def mock_favorite_service(mock_favorite_crud):
    return FavoriteService(crud=mock_favorite_crud)


@pytest.fixture
def favorite_dto():
    user_id = uuid4()
    component_id = uuid4()
    return FavoriteDTO(
        user_id=user_id,
        component_type="executor",
        component_id=component_id,
    )


@pytest.fixture
def mocked_favorite():
    user_id = uuid4()
    component_id = uuid4()
    return Favorite(
        user_id=user_id,
        component_type="executor",
        component_id=component_id,
    )
