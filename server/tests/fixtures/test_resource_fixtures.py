from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.resources.crud import ResourceCRUD
from application.resources.model import Resource, ResourceDTO
from application.resources.schema import DependencyConfig, DependencyTag, Outputs, ResourceResponse, Variables
from application.resources.service import ResourceService


@pytest.fixture
def mock_resource_crud():
    crud = Mock(spec=ResourceCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.patch = AsyncMock()
    crud.delete = AsyncMock()
    crud.get_dependencies = AsyncMock()
    return crud


@pytest.fixture
def mock_resource_service(
    mock_template_service,
    mock_resource_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_source_code_version_service,
    mock_storage_service,
    mock_integration_service,
    mock_permission_service,
    mocked_resource_temp_state_handler,
    mock_log_service,
    mock_task_entity_service,
):
    return ResourceService(
        crud=mock_resource_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        workspace_event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
        template_service=mock_template_service,
        integration_service=mock_integration_service,
        service_source_code_version=mock_source_code_version_service,
        storage_service=mock_storage_service,
        permission_service=mock_permission_service,
        resource_temp_state_handler=mocked_resource_temp_state_handler,
        log_service=mock_log_service,
        task_service=mock_task_entity_service,
    )


@pytest.fixture
def resource_response(
    mocked_user_response,
    template_response,
    source_code_version_response,
    storage_response,
    mocked_integration_response,
):
    return ResourceResponse(
        id=uuid4(),
        name="TestResource",
        labels=["label1", "label2"],
        template=template_response,
        source_code_version=source_code_version_response,
        storage=storage_response,
        storage_path="path/to/storage",
        integration_ids=[mocked_integration_response],
        secret_ids=[],
        creator=mocked_user_response,
        variables=[
            Variables(
                name="var1",
                value="value1",
                description="Variable 1",
                type="string",
                sensitive=False,
            ),
            Variables(
                name="var2",
                value="value2",
                description="Variable 2",
                type="string",
                sensitive=True,
            ),
        ],
        outputs=[
            Outputs(
                name="output1",
                value="value1",
                sensitive=False,
            ),
            Outputs(
                name="output2",
                value="value2",
                sensitive=True,
            ),
        ],
    )


@pytest.fixture
def mocked_resource(
    many_template_response,
    mocked_user,
    storage_response,
    mocked_integration,
):
    return Resource(
        id=uuid4(),
        name="TestResource",
        labels=["label1", "label2"],
        description="A test resource",
        template_id=many_template_response[0].id,
        template=many_template_response[0],
        source_code_version_id=None,
        storage_id=storage_response.id,
        storage_path="path/to/storage",
        integration_ids=[mocked_integration],
        secret_ids=[],
        creator=mocked_user,
        created_by=mocked_user.id,
        revision_number=1,
        parents=[],
        children=[],
        abstract=False,
        variables=[],
        outputs=[],
        dependency_tags=[],
        dependency_config=[],
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def many_resource_response(
    mocked_user_response,
    many_template_response,
    storage_response,
    mocked_integration_response,
    many_source_code_version_response,
):
    res_id1 = uuid4()
    res_id2 = uuid4()
    res_id3 = uuid4()
    res_id4 = uuid4()
    res1 = ResourceDTO(
        id=res_id1,
        name="TestResource1",
        labels=["label1", "label2"],
        parents=[],
        children=[res_id2],
        template_id=many_template_response[0].id,
        source_code_version_id=many_source_code_version_response[0].id,
        storage_id=storage_response.id,
        storage_path="path/to/storage",
        integration_ids=[mocked_integration_response.id],
        created_by=mocked_user_response.id,
        dependency_config=[
            DependencyConfig(
                name=f"DependencyConfig{c}",
                value=f"value{c}",
                inherited_by_children=True,
            )
            for c in range(2)
        ],
        dependency_tags=[
            DependencyTag(
                name=f"DependencyTag{t}",
                value=f"value{t}",
                inherited_by_children=True,
            )
            for t in range(2)
        ],
        variables=[
            Variables(
                name=v.name,
                value=0 if v.type == "number" else "value1",
                description="Variable 1",
                type=v.type,
                sensitive=False,
            )
            for v in many_source_code_version_response[0].variables
        ],
        outputs=[
            Outputs(
                name=o.name,
                value=f"value_{o.name}",
                sensitive=False,
            )
            for o in many_source_code_version_response[0].outputs
        ],
    )
    res2 = ResourceDTO(
        id=res_id2,
        name="TestResource2",
        labels=["label1", "label2"],
        parents=[res_id1],
        children=[res_id3, res_id4],
        template_id=many_template_response[1].id,
        source_code_version_id=many_source_code_version_response[1].id,
        storage_id=storage_response.id,
        storage_path="path/to/storage",
        integration_ids=[mocked_integration_response.id],
        created_by=mocked_user_response.id,
        dependency_config=[
            DependencyConfig(
                name=f"DependencyConfigResTwo{c}",
                value=f"value{c}",
                inherited_by_children=True,
            )
            for c in range(2)
        ],
        dependency_tags=[
            DependencyTag(
                name=f"DependencyTagResTwo{t}",
                value=f"value{t}",
                inherited_by_children=True,
            )
            for t in range(2)
        ],
        variables=[
            Variables(
                name=v.name,
                value=0 if v.type == "number" else "value1",
                description="Variable 1",
                type=v.type,
                sensitive=False,
            )
            for v in many_source_code_version_response[1].variables
        ],
        outputs=[
            Outputs(
                name=o.name,
                value=f"value_{o.name}",
                sensitive=False,
            )
            for o in many_source_code_version_response[1].outputs
        ],
    )
    res3 = ResourceDTO(
        id=res_id3,
        name="TestResource3",
        labels=["label1", "label2"],
        parents=[res_id2],
        children=[],
        template_id=many_template_response[2].id,
        source_code_version_id=many_source_code_version_response[2].id,
        storage_id=storage_response.id,
        storage_path="path/to/storage",
        integration_ids=[mocked_integration_response.id],
        created_by=mocked_user_response.id,
        variables=[
            Variables(
                name=v.name,
                value=0 if v.type == "number" else "value1",
                description="Variable 1",
                type=v.type,
                sensitive=False,
            )
            for v in many_source_code_version_response[2].variables
        ],
        outputs=[
            Outputs(
                name=o.name,
                value=f"value_{o.name}",
                sensitive=False,
            )
            for o in many_source_code_version_response[2].outputs
        ],
    )
    res4 = ResourceDTO(
        id=res_id4,
        name="TestResource4",
        labels=["label1", "label2"],
        parents=[res_id2],
        children=[],
        template_id=many_template_response[3].id,
        source_code_version_id=many_source_code_version_response[3].id,
        storage_id=storage_response.id,
        storage_path="path/to/storage",
        integration_ids=[mocked_integration_response.id],
        created_by=mocked_user_response.id,
        variables=[
            Variables(
                name=v.name,
                value=0 if v.type == "number" else "value1",
                description="Variable 1",
                type=v.type,
                sensitive=False,
            )
            for v in many_source_code_version_response[3].variables
        ],
        outputs=[
            Outputs(
                name=o.name,
                value=f"value_{o.name}",
                sensitive=False,
            )
            for o in many_source_code_version_response[3].outputs
        ],
    )
    return [
        res1,
        res2,
        res3,
        res4,
    ]
