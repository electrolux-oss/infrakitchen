from uuid import uuid4

import pytest

from application.source_code_versions.schema import (
    SourceConfigCreate,
    SourceConfigResponse,
)


class TestCreateConfig:
    @pytest.mark.asyncio
    async def test_create_config_success(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        mocked_source_config,
    ):
        config1 = mocked_source_config
        config1.id = uuid4()
        config2 = mocked_source_config
        config2.id = uuid4()

        configs = [config1, config2]
        configs_to_create = [SourceConfigCreate.model_validate(config) for config in configs]
        mock_source_code_version_crud.create_config.side_effect = [config1, config2]
        result = await mock_source_code_version_service.create_configs(configs=configs_to_create)
        assert len(result) == 2
        assert all(isinstance(r, SourceConfigResponse) for r in result)
