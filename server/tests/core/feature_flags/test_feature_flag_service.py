import uuid
from unittest.mock import AsyncMock, Mock

import pytest
from pydantic.errors import PydanticUserError

from core.feature_flags.model import FeatureFlag, FeatureFlagDTO
from core.feature_flags.service import FeatureFlagService


@pytest.fixture
def mock_feature_flag_crud():
    return Mock(
        get_by_name=AsyncMock(),
        get_all=AsyncMock(),
        update=AsyncMock(),
        refresh=AsyncMock(),
        delete=AsyncMock(),
        session=Mock(add=Mock(), flush=AsyncMock(), delete=AsyncMock()),
    )


@pytest.fixture
def mock_audit_log_handler():
    return Mock(
        create_log=AsyncMock(),
    )


@pytest.fixture
def feature_flag_service(mock_feature_flag_crud, mock_audit_log_handler):
    return FeatureFlagService(
        crud=mock_feature_flag_crud,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def feature_flag_model():
    return FeatureFlag(
        id=uuid.uuid4(),
        name="Approval Flow",
        enabled=True,
        updated_by=uuid.uuid4(),
    )


@pytest.fixture
def feature_flag_dto():
    return FeatureFlagDTO(
        name="Approval Flow",
        enabled=True,
        updated_by=uuid.uuid4(),
    )


class TestGetByName:
    @pytest.mark.asyncio
    async def test_get_by_name_not_found(self, feature_flag_service, mock_feature_flag_crud):
        mock_feature_flag_crud.get_by_name.return_value = None

        with pytest.raises(ValueError) as exc:
            await feature_flag_service.get_by_name("nonexistent_flag")

        assert str(exc.value) == "Feature flag with name nonexistent_flag does not exist"
        mock_feature_flag_crud.get_by_name.assert_awaited_once_with("nonexistent_flag")

    @pytest.mark.asyncio
    async def test_get_by_name_success(
        self, monkeypatch, feature_flag_service, mock_feature_flag_crud, feature_flag_model, feature_flag_dto
    ):
        mock_feature_flag_crud.get_by_name.return_value = feature_flag_model
        mocked_validate = Mock(return_value=feature_flag_dto)
        monkeypatch.setattr(FeatureFlagDTO, "model_validate", mocked_validate)

        result = await feature_flag_service.get_by_name("Test Feature Flag")

        assert result.name == feature_flag_dto.name
        assert result.enabled == feature_flag_dto.enabled
        assert result.updated_by == feature_flag_dto.updated_by

        mock_feature_flag_crud.get_by_name.assert_awaited_once_with("Test Feature Flag")
        mocked_validate.assert_called_once_with(feature_flag_model)

    @pytest.mark.asyncio
    async def test_get_by_name_exception(
        self, monkeypatch, feature_flag_service, mock_feature_flag_crud, feature_flag_model
    ):
        mock_feature_flag_crud.get_by_name.return_value = feature_flag_model

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(FeatureFlagDTO, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await feature_flag_service.get_by_name("Test Feature Flag")

        assert exc.value is error
        mock_feature_flag_crud.get_by_name.assert_awaited_once_with("Test Feature Flag")


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, feature_flag_service, mock_feature_flag_crud):
        mock_feature_flag_crud.get_all.return_value = []

        result = await feature_flag_service.get_all()

        assert result == []
        mock_feature_flag_crud.get_all.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_all_success(self, monkeypatch, feature_flag_service, mock_feature_flag_crud):
        feature_flags = [
            FeatureFlag(
                id=uuid.uuid4(),
                name="Approval Flow",
                enabled=True,
                updated_by=uuid.uuid4(),
            ),
            FeatureFlag(
                id=uuid.uuid4(),
                name="Disapproval Flow",
                enabled=False,
                updated_by=uuid.uuid4(),
            ),
        ]
        mock_feature_flag_crud.get_all.return_value = feature_flags

        feature_flag_dto_1 = FeatureFlagDTO(
            name="Approval Flow",
            enabled=True,
            updated_by=feature_flags[0].updated_by,
        )
        feature_flag_dto_2 = FeatureFlagDTO(
            name="Disapproval Flow",
            enabled=False,
            updated_by=feature_flags[1].updated_by,
        )

        def mock_model_validate(arg):
            return feature_flag_dto_1 if arg.name == "Approval Flow" else feature_flag_dto_2

        monkeypatch.setattr(FeatureFlagDTO, "model_validate", mock_model_validate)

        result = await feature_flag_service.get_all()

        assert result == [feature_flag_dto_1, feature_flag_dto_2]
        mock_feature_flag_crud.get_all.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_all_exception(
        self, monkeypatch, feature_flag_service, mock_feature_flag_crud, feature_flag_model
    ):
        mock_feature_flag_crud.get_all.return_value = [feature_flag_model]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(FeatureFlagDTO, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await feature_flag_service.get_all()

        assert exc.value is error
        mock_feature_flag_crud.get_all.assert_awaited_once()


class TestUpdateConfig:
    @pytest.mark.asyncio
    async def test_update_config_success(
        self,
        monkeypatch,
        feature_flag_service,
        mock_feature_flag_crud,
        mock_audit_log_handler,
        feature_flag_model,
        feature_flag_dto,
        mocked_user,
    ):
        mock_feature_flag_crud.get_by_name.return_value = feature_flag_model
        mock_feature_flag_crud.update.return_value = feature_flag_model

        mocked_model_db_dump = Mock(return_value={"name": "Approval Flow", "enabled": True})
        monkeypatch.setattr("core.feature_flags.service.model_db_dump", mocked_model_db_dump)

        mocked_validate = Mock(return_value=feature_flag_dto)
        monkeypatch.setattr(FeatureFlagDTO, "model_validate", mocked_validate)

        result = await feature_flag_service.update_config(feature_flag_dto, mocked_user)

        assert result.name == feature_flag_dto.name
        assert result.enabled == feature_flag_dto.enabled

        mock_feature_flag_crud.get_by_name.assert_awaited_once_with(feature_flag_dto.name)
        mock_feature_flag_crud.update.assert_awaited_once_with(
            feature_flag_model, {"name": "Approval Flow", "enabled": True}
        )
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            str(feature_flag_model.id), mocked_user.id, f"Set to ${feature_flag_dto.enabled}"
        )
        mocked_validate.assert_called_once_with(feature_flag_model)

    @pytest.mark.asyncio
    async def test_update_config_not_found(
        self, feature_flag_service, mock_feature_flag_crud, feature_flag_dto, mocked_user
    ):
        mock_feature_flag_crud.get_by_name.return_value = None

        with pytest.raises(ValueError) as exc:
            await feature_flag_service.update_config(feature_flag_dto, mocked_user)

        assert str(exc.value) == "Feature flag with name Approval Flow does not exist"
        mock_feature_flag_crud.get_by_name.assert_awaited_once_with(feature_flag_dto.name)

    @pytest.mark.asyncio
    async def test_update_config_audit_log_error(
        self,
        monkeypatch,
        feature_flag_service,
        mock_feature_flag_crud,
        mock_audit_log_handler,
        feature_flag_model,
        feature_flag_dto,
        mocked_user,
    ):
        mock_feature_flag_crud.get_by_name.return_value = feature_flag_model
        mock_feature_flag_crud.update.return_value = feature_flag_model

        mocked_model_db_dump = Mock(return_value={"name": "Approval Flow", "enabled": True})
        monkeypatch.setattr("core.feature_flags.service.model_db_dump", mocked_model_db_dump)

        error = RuntimeError("Audit log failure")
        mock_audit_log_handler.create_log.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await feature_flag_service.update_config(feature_flag_dto, mocked_user)

        assert exc.value is error
        mock_feature_flag_crud.get_by_name.assert_awaited_once_with(feature_flag_dto.name)
        mock_feature_flag_crud.update.assert_awaited_once_with(
            feature_flag_model, {"name": "Approval Flow", "enabled": True}
        )

    @pytest.mark.asyncio
    async def test_update_config_crud_error(
        self,
        monkeypatch,
        feature_flag_service,
        mock_feature_flag_crud,
        feature_flag_model,
        feature_flag_dto,
        mocked_user,
    ):
        mock_feature_flag_crud.get_by_name.return_value = feature_flag_model

        mocked_model_db_dump = Mock(return_value={"name": "Approval Flow", "enabled": True})
        monkeypatch.setattr("core.feature_flags.service.model_db_dump", mocked_model_db_dump)

        error = RuntimeError("Database error")
        mock_feature_flag_crud.update.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await feature_flag_service.update_config(feature_flag_dto, mocked_user)

        assert exc.value is error
        mock_feature_flag_crud.get_by_name.assert_awaited_once_with(feature_flag_dto.name)
        mock_feature_flag_crud.update.assert_awaited_once_with(
            feature_flag_model, {"name": "Approval Flow", "enabled": True}
        )


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(self, monkeypatch, feature_flag_service, mock_feature_flag_crud, feature_flag_dto):
        new_feature_flag = FeatureFlag(
            id=uuid.uuid4(),
            name=feature_flag_dto.name,
            enabled=feature_flag_dto.enabled,
            updated_by=feature_flag_dto.updated_by,
        )

        mocked_validate = Mock(return_value=feature_flag_dto)
        monkeypatch.setattr(FeatureFlagDTO, "model_validate", mocked_validate)

        with monkeypatch.context() as m:
            mock_feature_flag_constructor = Mock(return_value=new_feature_flag)
            m.setattr("core.feature_flags.service.FeatureFlag", mock_feature_flag_constructor)

            result = await feature_flag_service.create(feature_flag_dto)

            assert result.name == feature_flag_dto.name
            assert result.enabled == feature_flag_dto.enabled

            mock_feature_flag_constructor.assert_called_once_with(
                name=feature_flag_dto.name,
                config_name=feature_flag_dto.config_name,
                enabled=feature_flag_dto.enabled,
                updated_by=feature_flag_dto.updated_by,
            )

            mock_feature_flag_crud.session.add.assert_called_once_with(new_feature_flag)
            mock_feature_flag_crud.session.flush.assert_awaited_once()
            mock_feature_flag_crud.refresh.assert_awaited_once_with(new_feature_flag)
            mocked_validate.assert_called_once_with(new_feature_flag)

    @pytest.mark.asyncio
    async def test_create_validation_error(
        self, monkeypatch, feature_flag_service, mock_feature_flag_crud, feature_flag_dto
    ):
        new_feature_flag = FeatureFlag(
            id=uuid.uuid4(),
            name=feature_flag_dto.name,
            enabled=feature_flag_dto.enabled,
            updated_by=feature_flag_dto.updated_by,
        )

        error = PydanticUserError(message="Validation error", code="validate-by-alias-and-name-false")
        mocked_validate = Mock(side_effect=error)
        monkeypatch.setattr(FeatureFlagDTO, "model_validate", mocked_validate)

        with monkeypatch.context() as m:
            mock_feature_flag_constructor = Mock(return_value=new_feature_flag)
            m.setattr("core.feature_flags.service.FeatureFlag", mock_feature_flag_constructor)

            with pytest.raises(PydanticUserError) as exc:
                await feature_flag_service.create(feature_flag_dto)

            assert exc.value is error
            mock_feature_flag_crud.session.add.assert_called_once_with(new_feature_flag)
            mock_feature_flag_crud.session.flush.assert_awaited_once()
            mock_feature_flag_crud.refresh.assert_awaited_once_with(new_feature_flag)


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success_existing_flag(
        self, feature_flag_service, mock_feature_flag_crud, feature_flag_model, feature_flag_dto
    ):
        mock_feature_flag_crud.get_by_name.return_value = feature_flag_model

        await feature_flag_service.delete(feature_flag_dto)

        mock_feature_flag_crud.get_by_name.assert_awaited_once_with(feature_flag_dto.name)
        mock_feature_flag_crud.delete.assert_awaited_once_with(feature_flag_model)

    @pytest.mark.asyncio
    async def test_delete_nonexistent_flag(self, feature_flag_service, mock_feature_flag_crud, feature_flag_dto):
        mock_feature_flag_crud.get_by_name.return_value = None

        await feature_flag_service.delete(feature_flag_dto)

        mock_feature_flag_crud.get_by_name.assert_awaited_once_with(feature_flag_dto.name)
        mock_feature_flag_crud.delete.assert_not_awaited()
