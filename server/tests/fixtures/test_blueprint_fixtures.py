from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.blueprints.crud import BlueprintCRUD
from application.blueprints.model import Blueprint
from application.blueprints.schema import BlueprintResponse
from application.blueprints.service import BlueprintService


@pytest.fixture
def mock_blueprint_crud():
    crud = Mock(spec=BlueprintCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete = AsyncMock()
    crud.session = AsyncMock()
    return crud


@pytest.fixture
def mock_blueprint_service(
    mock_blueprint_crud,
    mock_workflow_service,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
):
    return BlueprintService(
        crud=mock_blueprint_crud,
        workflow_service=mock_workflow_service,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def mocked_blueprint(mocked_user, mocked_template):
    return Blueprint(
        id=uuid4(),
        name="Test Blueprint",
        description="A test blueprint",
        templates=[mocked_template],
        wiring=[],
        default_variables={},
        configuration={},
        labels=["test"],
        status="enabled",
        revision_number=1,
        creator=mocked_user,
        created_by=mocked_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def blueprint_response(mocked_blueprint):
    return BlueprintResponse.model_validate(mocked_blueprint)
