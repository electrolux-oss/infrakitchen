import uuid
from unittest.mock import Mock

import pytest
from pydantic import PydanticUserError

from application.resource_temp_state.schema import ResourceTempStateResponse
from core.errors import EntityNotFound


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self,
        mocked_resource_temp_state_service,
        mocked_resource_temp_state_crud,
        mocked_resource_temp_state,
        mocked_resource_temp_state_response,
        monkeypatch,
    ):
        mocked_resource_temp_state_crud.get_by_id.return_value = mocked_resource_temp_state

        mocked_validate = Mock(return_value=mocked_resource_temp_state_response)
        monkeypatch.setattr(ResourceTempStateResponse, "model_validate", mocked_validate)

        result = await mocked_resource_temp_state_service.get_by_id(str(mocked_resource_temp_state.id))

        assert result == mocked_resource_temp_state_response
        mocked_resource_temp_state_crud.get_by_id.assert_called_once_with(str(mocked_resource_temp_state.id))
        mocked_validate.assert_called_once_with(mocked_resource_temp_state)

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mocked_resource_temp_state_service, mocked_resource_temp_state_crud):
        mocked_resource_temp_state_crud.get_by_id.return_value = None

        result = await mocked_resource_temp_state_service.get_by_id("non-existent-id")

        assert result is None
        mocked_resource_temp_state_crud.get_by_id.assert_awaited_once_with("non-existent-id")

    @pytest.mark.asyncio
    async def test_get_by_id_error(
        self,
        mocked_resource_temp_state_service,
        mocked_resource_temp_state_crud,
        mocked_resource_temp_state,
        monkeypatch,
    ):
        mocked_resource_temp_state_crud.get_by_id.return_value = mocked_resource_temp_state

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(ResourceTempStateResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mocked_resource_temp_state_service.get_by_id(str(mocked_resource_temp_state.id))

        assert exc.value is error
        mocked_resource_temp_state_crud.get_by_id.assert_awaited_once_with(str(mocked_resource_temp_state.id))


class TestGetByResourceId:
    @pytest.mark.asyncio
    async def test_get_by_resource_id_success(
        self,
        mocked_resource_temp_state_service,
        mocked_resource_temp_state_crud,
        mocked_resource_temp_state_response,
        mocked_resource_temp_state,
        monkeypatch,
    ):
        mocked_resource_temp_state_crud.get_by_resource_id.return_value = mocked_resource_temp_state

        mocked_validate = Mock(return_value=mocked_resource_temp_state_response)
        monkeypatch.setattr(ResourceTempStateResponse, "model_validate", mocked_validate)

        result = await mocked_resource_temp_state_service.get_by_resource_id(
            str(mocked_resource_temp_state.resource_id)
        )

        assert result == mocked_resource_temp_state_response
        mocked_resource_temp_state_crud.get_by_resource_id.assert_called_once_with(
            str(mocked_resource_temp_state.resource_id)
        )
        mocked_validate.assert_called_once_with(mocked_resource_temp_state)

    @pytest.mark.asyncio
    async def test_get_by_resource_id_not_found(
        self, mocked_resource_temp_state_service, mocked_resource_temp_state_crud
    ):
        mocked_resource_temp_state_crud.get_by_resource_id.return_value = None

        result = await mocked_resource_temp_state_service.get_by_resource_id("non-existent-resource-id")

        assert result is None
        mocked_resource_temp_state_crud.get_by_resource_id.assert_awaited_once_with("non-existent-resource-id")

    @pytest.mark.asyncio
    async def test_get_by_resource_id_error(
        self,
        mocked_resource_temp_state_service,
        mocked_resource_temp_state_crud,
        mocked_resource_temp_state,
        monkeypatch,
    ):
        mocked_resource_temp_state_crud.get_by_resource_id.return_value = mocked_resource_temp_state

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(ResourceTempStateResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mocked_resource_temp_state_service.get_by_resource_id(str(mocked_resource_temp_state.resource_id))

        assert exc.value is error
        mocked_resource_temp_state_crud.get_by_resource_id.assert_awaited_once_with(
            str(mocked_resource_temp_state.resource_id)
        )


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all(
        self,
        mocked_resource_temp_state_service,
        mocked_resource_temp_state_crud,
        mocked_resource_temp_state_response,
        mocked_resource_temp_state,
        monkeypatch,
    ):
        mocked_resource_temp_state_2 = mocked_resource_temp_state
        mocked_resource_temp_state_2.resource_id = uuid.UUID

        mocked_resource_temp_state_crud.get_all.return_value = [
            mocked_resource_temp_state,
            mocked_resource_temp_state_2,
        ]

        mocked_resource_temp_state_response_2 = mocked_resource_temp_state_response
        mocked_resource_temp_state_response_2.resource_id = mocked_resource_temp_state_2.resource_id

        def mock_model_validate_validate(arg):
            return (
                mocked_resource_temp_state_response
                if arg.resource_id == mocked_resource_temp_state.resource_id
                else mocked_resource_temp_state_response_2
            )

        monkeypatch.setattr(ResourceTempStateResponse, "model_validate", mock_model_validate_validate)

        result = await mocked_resource_temp_state_service.get_all(limit=10, offset=0)

        assert result == [mocked_resource_temp_state_response, mocked_resource_temp_state_response_2]
        mocked_resource_temp_state_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_empty(self, mocked_resource_temp_state_service, mocked_resource_temp_state_crud):
        mocked_resource_temp_state_crud.get_all.return_value = []

        result = await mocked_resource_temp_state_service.get_all(limit=10, offset=0)

        assert result == []
        mocked_resource_temp_state_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(
        self,
        mocked_resource_temp_state_service,
        mocked_resource_temp_state_crud,
        mocked_resource_temp_state,
        monkeypatch,
    ):
        mocked_resource_temp_state_crud.get_all.return_value = [mocked_resource_temp_state]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(ResourceTempStateResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mocked_resource_temp_state_service.get_all(limit=10, offset=0)

        assert exc.value is error
        mocked_resource_temp_state_crud.get_all.assert_awaited_once_with(limit=10, offset=0)


class TestDeleteByResourceId:
    @pytest.mark.asyncio
    async def test_delete_by_resource_id_success(
        self,
        mocked_resource_temp_state_service,
        mocked_resource_temp_state_crud,
        mocked_resource_temp_state,
    ):
        mocked_resource_temp_state_crud.get_by_resource_id.return_value = mocked_resource_temp_state

        result = await mocked_resource_temp_state_service.delete_by_resource_id(
            str(mocked_resource_temp_state.resource_id)
        )

        assert result is None
        mocked_resource_temp_state_crud.get_by_resource_id.assert_awaited_once_with(
            str(mocked_resource_temp_state.resource_id)
        )
        mocked_resource_temp_state_crud.delete.assert_awaited_once_with(mocked_resource_temp_state)

    @pytest.mark.asyncio
    async def test_delete_by_resource_id_not_found(
        self, mocked_resource_temp_state_service, mocked_resource_temp_state_crud
    ):
        mocked_resource_temp_state_crud.get_by_resource_id.return_value = None

        with pytest.raises(EntityNotFound, match="ResourceTempState not found"):
            await mocked_resource_temp_state_service.delete_by_resource_id("non-existent-resource-id")

        mocked_resource_temp_state_crud.get_by_resource_id.assert_awaited_once_with("non-existent-resource-id")
        mocked_resource_temp_state_crud.delete.assert_not_called()
