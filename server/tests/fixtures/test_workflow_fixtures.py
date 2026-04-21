from datetime import datetime

import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from application.workflows.crud import WorkflowCRUD
from application.workflows.model import Workflow, WorkflowStep
from application.workflows.schema import WorkflowResponse, WorkflowStepResponse
from application.workflows.service import WorkflowService


@pytest.fixture
def mock_workflow_crud():
    crud = Mock(spec=WorkflowCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete = AsyncMock()
    crud.update_step = AsyncMock()
    return crud


@pytest.fixture
def mock_workflow_service(
    mock_workflow_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
):
    return WorkflowService(
        crud=mock_workflow_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def mocked_workflow_step(mocked_user, mocked_template):
    return WorkflowStep(
        id=uuid4(),
        workflow_id=uuid4(),
        template_id=mocked_template.id,
        template=mocked_template,
        resource_id=None,
        resource=None,
        source_code_version_id=None,
        source_code_version=None,
        parent_resource_ids=[],
        parent_resources=[],
        integration_ids=[],
        secret_ids=[],
        storage_id=None,
        position=0,
        status="pending",
        error_message=None,
        resolved_variables={"key": "value"},
        started_at=None,
        completed_at=None,
    )


@pytest.fixture
def mocked_workflow(mocked_user, mocked_workflow_step):
    workflow_id = uuid4()
    mocked_workflow_step.workflow_id = workflow_id
    return Workflow(
        id=workflow_id,
        action="create",
        wiring_snapshot=[],
        variable_overrides={},
        status="pending",
        error_message=None,
        created_by=mocked_user.id,
        creator=mocked_user,
        steps=[mocked_workflow_step],
        started_at=None,
        completed_at=None,
        created_at=datetime.now(),
    )


@pytest.fixture
def workflow_step_response(mocked_workflow_step):
    return WorkflowStepResponse.model_validate(mocked_workflow_step)


@pytest.fixture
def workflow_response(mocked_workflow):
    return WorkflowResponse.model_validate(mocked_workflow)
