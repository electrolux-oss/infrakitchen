from uuid import uuid4

import pytest

from application.source_code_versions.schema import (
    SourceConfigCreate,
    SourceConfigResponse,
)
from core.errors import EntityNotFound


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        mocked_source_config,
    ):
        mock_source_code_version_crud.get_config_by_id.return_value = mocked_source_config
        result = await mock_source_code_version_service.get_config_by_id(mocked_source_config.id)
        assert isinstance(result, SourceConfigResponse)

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
    ):
        mock_source_code_version_crud.get_config_by_id.return_value = None
        with pytest.raises(EntityNotFound):
            await mock_source_code_version_service.get_config_by_id(str(uuid4()))


class TestCreateConfig:
    @pytest.mark.asyncio
    async def test_create_config_success(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        mocked_source_config,
        source_code_version,
    ):
        config1 = mocked_source_config
        config1.id = uuid4()
        config2 = mocked_source_config
        config2.id = uuid4()

        configs = [config1, config2]
        configs_to_create = [SourceConfigCreate.model_validate(config) for config in configs]
        mock_source_code_version_crud.create_config.side_effect = [config1, config2]
        mock_source_code_version_crud.get_by_id.return_value = source_code_version
        result = await mock_source_code_version_service.create_configs(configs=configs_to_create)
        assert len(result) == 2
        assert all(isinstance(r, SourceConfigResponse) for r in result)
