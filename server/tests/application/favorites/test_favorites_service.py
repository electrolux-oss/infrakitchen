from unittest.mock import Mock
from uuid import uuid4

import pytest

from application.favorites.model import FavoriteDTO
from application.favorites.schema import FavoriteCreate
from core.errors import EntityNotFound


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_favorite_service):
        user_id = uuid4()
        component_id = uuid4()
        mock_favorite_service.crud.get_by_id.return_value = None

        result = await mock_favorite_service.get_by_id(user_id, "executor", component_id)

        assert result is None
        mock_favorite_service.crud.get_by_id.assert_awaited_once_with(user_id, "executor", component_id)

    @pytest.mark.asyncio
    async def test_get_by_id_success(self, monkeypatch, mock_favorite_service, favorite_dto, mocked_favorite):
        mock_favorite_service.crud.get_by_id.return_value = mocked_favorite
        mocked_validate = Mock(return_value=favorite_dto)
        monkeypatch.setattr(FavoriteDTO, "model_validate", mocked_validate)

        result = await mock_favorite_service.get_by_id(favorite_dto.user_id, "executor", favorite_dto.component_id)

        assert result.user_id == favorite_dto.user_id
        assert result.component_type == favorite_dto.component_type
        assert result.component_id == favorite_dto.component_id

        mock_favorite_service.crud.get_by_id.assert_awaited_once_with(
            favorite_dto.user_id, "executor", favorite_dto.component_id
        )
        mocked_validate.assert_called_once_with(mocked_favorite)

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, monkeypatch, mock_favorite_service, mocked_favorite):
        mock_favorite_service.crud.get_by_id.return_value = mocked_favorite

        error = ValueError("Validation error")
        monkeypatch.setattr(FavoriteDTO, "model_validate", Mock(side_effect=error))

        with pytest.raises(ValueError) as exc:
            await mock_favorite_service.get_by_id(
                mocked_favorite.user_id, mocked_favorite.component_type, mocked_favorite.component_id
            )

        assert exc.value is error
        mock_favorite_service.crud.get_by_id.assert_awaited_once_with(
            mocked_favorite.user_id, mocked_favorite.component_type, mocked_favorite.component_id
        )


class TestGetAllByUserId:
    @pytest.mark.asyncio
    async def test_get_all_by_user_id_empty(self, mock_favorite_service):
        user_id = uuid4()
        mock_favorite_service.crud.get_all_by_user_id.return_value = []

        result = await mock_favorite_service.get_all_by_user_id(user_id)

        assert result == []
        mock_favorite_service.crud.get_all_by_user_id.assert_awaited_once_with(user_id)

    @pytest.mark.asyncio
    async def test_get_all_by_user_id_success(self, monkeypatch, mock_favorite_service, favorite_dto, mocked_favorite):
        user_id = uuid4()
        favorites = [mocked_favorite]
        mock_favorite_service.crud.get_all_by_user_id.return_value = favorites

        def mock_model_validate(arg):
            return favorite_dto

        monkeypatch.setattr(FavoriteDTO, "model_validate", mock_model_validate)

        result = await mock_favorite_service.get_all_by_user_id(user_id)

        assert len(result) == 1
        assert result[0].user_id == favorite_dto.user_id
        mock_favorite_service.crud.get_all_by_user_id.assert_awaited_once_with(user_id)

    @pytest.mark.asyncio
    async def test_get_all_by_user_id_error(self, monkeypatch, mock_favorite_service, mocked_favorite):
        user_id = uuid4()
        favorites = [mocked_favorite]
        mock_favorite_service.crud.get_all_by_user_id.return_value = favorites

        error = ValueError("Validation error")
        monkeypatch.setattr(FavoriteDTO, "model_validate", Mock(side_effect=error))

        with pytest.raises(ValueError) as exc:
            await mock_favorite_service.get_all_by_user_id(user_id)

        assert exc.value is error
        mock_favorite_service.crud.get_all_by_user_id.assert_awaited_once_with(user_id)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_favorite_service):
        mock_favorite_service.crud.count.return_value = 5

        result = await mock_favorite_service.count()

        assert result == 5
        mock_favorite_service.crud.count.assert_awaited_once_with(filter=None)

    @pytest.mark.asyncio
    async def test_count_with_filter(self, mock_favorite_service):
        mock_favorite_service.crud.count.return_value = 2
        filter_dict = {"component_type": "executor"}

        result = await mock_favorite_service.count(filter=filter_dict)

        assert result == 2
        mock_favorite_service.crud.count.assert_awaited_once_with(filter=filter_dict)


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(self, monkeypatch, mock_favorite_service, favorite_dto, mocked_favorite):
        user_id = uuid4()
        component_id = uuid4()
        favorite_create = FavoriteCreate(component_type="executor", component_id=component_id)

        mock_favorite_service.crud.get_by_id.return_value = None
        mock_favorite_service.crud.create.return_value = mocked_favorite
        mocked_validate = Mock(return_value=favorite_dto)
        monkeypatch.setattr(FavoriteDTO, "model_validate", mocked_validate)

        result = await mock_favorite_service.create(favorite_create, user_id)

        assert result.user_id == favorite_dto.user_id
        assert result.component_type == favorite_dto.component_type
        assert result.component_id == favorite_dto.component_id

        mock_favorite_service.crud.get_by_id.assert_awaited_once_with(
            user_id=user_id, component_type="executor", component_id=component_id
        )
        mock_favorite_service.crud.create.assert_awaited_once()
        mock_favorite_service.crud.refresh.assert_awaited_once_with(mocked_favorite)
        mocked_validate.assert_called_once_with(mocked_favorite)

    @pytest.mark.asyncio
    async def test_create_already_exists(self, monkeypatch, mock_favorite_service, favorite_dto, mocked_favorite):
        user_id = uuid4()
        component_id = uuid4()
        favorite_create = FavoriteCreate(component_type="executor", component_id=component_id)

        mock_favorite_service.crud.get_by_id.return_value = mocked_favorite
        mocked_validate = Mock(return_value=favorite_dto)
        monkeypatch.setattr(FavoriteDTO, "model_validate", mocked_validate)

        result = await mock_favorite_service.create(favorite_create, user_id)

        assert result.user_id == favorite_dto.user_id
        mock_favorite_service.crud.get_by_id.assert_awaited_once_with(
            user_id=user_id, component_type="executor", component_id=component_id
        )
        mock_favorite_service.crud.create.assert_not_awaited()
        mock_favorite_service.crud.refresh.assert_not_awaited()
        mocked_validate.assert_called_once_with(mocked_favorite)

    @pytest.mark.asyncio
    async def test_create_error(self, mock_favorite_service):
        user_id = uuid4()
        component_id = uuid4()
        favorite_create = FavoriteCreate(component_type="executor", component_id=component_id)

        mock_favorite_service.crud.get_by_id.return_value = None
        error = RuntimeError("create fail")
        mock_favorite_service.crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_favorite_service.create(favorite_create, user_id)

        assert exc.value is error
        mock_favorite_service.crud.create.assert_awaited_once()


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(self, mock_favorite_service, mocked_favorite):
        user_id = mocked_favorite.user_id
        component_type = mocked_favorite.component_type
        component_id = mocked_favorite.component_id

        mock_favorite_service.crud.get_by_id.return_value = mocked_favorite

        await mock_favorite_service.delete(user_id, component_type, component_id)

        mock_favorite_service.crud.get_by_id.assert_awaited_once_with(user_id, component_type, component_id)
        mock_favorite_service.crud.delete.assert_awaited_once_with(mocked_favorite)

    @pytest.mark.asyncio
    async def test_delete_not_found(self, mock_favorite_service):
        user_id = uuid4()
        component_id = uuid4()

        mock_favorite_service.crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Favorite not found"):
            await mock_favorite_service.delete(user_id, "executor", component_id)

        mock_favorite_service.crud.get_by_id.assert_awaited_once_with(user_id, "executor", component_id)
        mock_favorite_service.crud.delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_error(self, mock_favorite_service, mocked_favorite):
        user_id = mocked_favorite.user_id
        component_type = mocked_favorite.component_type
        component_id = mocked_favorite.component_id

        mock_favorite_service.crud.get_by_id.return_value = mocked_favorite
        error = RuntimeError("delete fail")
        mock_favorite_service.crud.delete.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_favorite_service.delete(user_id, component_type, component_id)

        assert exc.value is error
        mock_favorite_service.crud.delete.assert_awaited_once_with(mocked_favorite)


class TestDeleteAllByComponent:
    @pytest.mark.asyncio
    async def test_delete_all_by_component_success(self, mock_favorite_service):
        component_id = uuid4()

        await mock_favorite_service.delete_all_by_component("executor", component_id)

        mock_favorite_service.crud.delete_all_by_component.assert_awaited_once_with("executor", component_id)

    @pytest.mark.asyncio
    async def test_delete_all_by_component_resource(self, mock_favorite_service):
        component_id = uuid4()

        await mock_favorite_service.delete_all_by_component("resource", component_id)

        mock_favorite_service.crud.delete_all_by_component.assert_awaited_once_with("resource", component_id)

    @pytest.mark.asyncio
    async def test_delete_all_by_component_error(self, mock_favorite_service):
        component_id = uuid4()
        error = RuntimeError("delete fail")
        mock_favorite_service.crud.delete_all_by_component.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_favorite_service.delete_all_by_component("executor", component_id)

        assert exc.value is error
        mock_favorite_service.crud.delete_all_by_component.assert_awaited_once_with("executor", component_id)
