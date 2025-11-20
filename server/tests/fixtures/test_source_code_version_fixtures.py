from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.source_code_versions.crud import SourceCodeVersionCRUD
from application.source_code_versions.model import (
    SourceCodeVersion,
    SourceCodeVersionDTO,
    VariableModel,
    OutputVariableModel,
    SourceConfig,
)
from application.source_code_versions.schema import (
    SourceCodeVersionResponse,
    SourceConfigResponse,
    SourceOutputConfigResponse,
)
from application.source_code_versions.service import SourceCodeVersionService
from core.constants import ModelStatus


@pytest.fixture
def mock_source_code_version_crud():
    crud = Mock(spec=SourceCodeVersionCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.patch = AsyncMock()
    crud.delete = AsyncMock()
    crud.get_configs_by_scv_id = AsyncMock()
    crud.get_config_by_id = AsyncMock()
    crud.create_config = AsyncMock()
    crud.update_config = AsyncMock()
    crud.get_output_all = AsyncMock()
    crud.get_output_by_scv_id = AsyncMock()
    crud.create_output_config = AsyncMock()
    crud.get_dependencies = AsyncMock()
    return crud


@pytest.fixture
def mock_source_code_version_service(
    mock_source_code_version_crud,
    mock_template_service,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_source_code_service,
    mock_log_service,
    mock_task_entity_service,
):
    return SourceCodeVersionService(
        template_service=mock_template_service,
        source_code_service=mock_source_code_service,
        crud=mock_source_code_version_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
        log_service=mock_log_service,
        task_service=mock_task_entity_service,
    )


@pytest.fixture
def source_code_version_response(mocked_user_response, template_response, mocked_source_code_response):
    return SourceCodeVersionResponse(
        id=uuid4(),
        labels=["label1", "label2"],
        creator=mocked_user_response,
        template=template_response,
        source_code=mocked_source_code_response,
    )


@pytest.fixture
def source_code_version(mocked_user, mocked_template, mocked_source_code):
    return SourceCodeVersion(
        id=uuid4(),
        source_code_id=mocked_source_code.id,
        source_code=mocked_source_code,
        template_id=mocked_template.id,
        template=mocked_template,
        source_code_folder="source_code_folder/test_folder",
        source_code_version="v0.1",
        labels=["label1", "label2"],
        created_at=datetime.now(),
        updated_at=datetime.now(),
        revision_number=1,
        creator=mocked_user,
        created_by=mocked_user.id,
        description="Test Source Code Version 1",
        variables=[
            VariableModel(
                name="var_one",
                type="string",
                description="Variable One",
                required=True,
            ),
            VariableModel(
                name="var_two",
                description="Variable Two",
                type="number",
                default=3,
                required=False,
            ),
        ],
        outputs=[
            OutputVariableModel(
                name="output1",
                value="output1",
                description="Output Variable 1",
            ),
            OutputVariableModel(
                name="output2",
                description="Output Variable 2",
                value="output2",
            ),
        ],
        status=ModelStatus.DONE,
    )


@pytest.fixture
def many_source_code_version_response(mocked_user_response, mocked_source_code_response, many_template_response):
    scvs: list[SourceCodeVersionDTO] = []
    for idx, comp in enumerate(many_template_response):
        scv = SourceCodeVersionDTO(
            id=uuid4(),
            source_code_id=mocked_source_code_response.id,
            created_by=mocked_user_response.id,
            template_id=comp.id,
            source_code_folder=f"source_code_folder/test_folder{idx}",
            source_code_version=f"v{idx}.0.1",
            labels=["label1", "label2"],
            variables=[
                VariableModel(
                    name=f"var_one_{idx}",
                    type="string",
                    description=f"Variable One {idx}",
                    required=True,
                ),
                VariableModel(
                    name=f"var_two_{idx}",
                    description=f"Variable Two {idx}",
                    type="number",
                    default=3 * idx,
                    required=False,
                ),
            ],
            outputs=[
                OutputVariableModel(
                    name=f"output1_{idx}",
                    value=f"output1_{idx}",
                    description=f"Output Variable 1 {idx}",
                ),
                OutputVariableModel(
                    name=f"output2_{idx}",
                    description=f"Output Variable 2 {idx}",
                    value=f"output2_{idx}",
                ),
            ],
        )
        scvs.append(scv)
    return scvs


@pytest.fixture
def mocked_source_code_versions_response(mocked_user_response, mocked_source_code_response, many_template_response):
    return SourceCodeVersionResponse(
        id=uuid4(),
        creator=mocked_user_response,
        source_code_folder="source_code_folder/test_folder",
        source_code_version="v0.1",
        labels=["label1", "label2"],
        variables=[
            VariableModel(
                name="var_one",
                type="string",
                description="Variable One",
                required=True,
            )
        ],
        outputs=[
            OutputVariableModel(
                name="output1",
                value="output1",
                description="Output Variable 1",
            )
        ],
        status=ModelStatus.DONE,
        template=many_template_response[0],
        source_code=mocked_source_code_response,
    )


@pytest.fixture
def mocked_source_config():
    return SourceConfig(
        id=uuid4(),
        source_code_version_id=uuid4(),
        name="source_code_config",
        type="string",
        description="Source Code Config",
        required=False,
    )


@pytest.fixture
def mocked_source_config_response():
    return SourceConfigResponse(
        id=uuid4(),
        source_code_version_id=uuid4(),
        name="source_code_config",
        type="string",
        description="Source Code Config",
    )


@pytest.fixture
def mocked_source_output_configs_response():
    return SourceOutputConfigResponse(
        id=uuid4(),
        index=0,
        source_code_version_id=uuid4(),
        name="source_code_output_1",
        description="Source Code Output 1",
    )
