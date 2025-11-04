from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from application.templates.crud import TemplateCRUD
from application.templates.model import Template, TemplateDTO
from application.templates.schema import TemplateResponse
from application.templates.service import TemplateService

TEMPLATE_ID = "abc123"


@pytest.fixture
def mock_template_crud():
    crud = Mock(spec=TemplateCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.patch = AsyncMock()
    crud.delete = AsyncMock()
    crud.get_tree = AsyncMock()
    crud.get_dependencies = AsyncMock()
    return crud


@pytest.fixture
def mock_template_service(
    mock_template_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
):
    return TemplateService(
        crud=mock_template_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def template_response():
    return TemplateResponse(id=uuid4(), name="Test Template", template="template1")


@pytest.fixture
def mocked_template(mocked_user):
    return Template(
        id=uuid4(),
        name="Test Template",
        template="template1",
        creator=mocked_user,
        created_by=mocked_user.id,
        revision_number=1,
        parents=[],
        children=[],
        abstract=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        cloud_resource_types=[],
        labels=["test_label"],
        description="A test template",
    )


@pytest.fixture
def many_template_response(mocked_user_response):
    comp_id1 = uuid4()
    comp_id2 = uuid4()
    comp_id3 = uuid4()
    comp_id4 = uuid4()
    comp1 = TemplateDTO(
        id=comp_id1,
        name="Test Template 1",
        template="template1",
        created_by=mocked_user_response.id,
        children=[comp_id2],
    )
    comp2 = TemplateDTO(
        id=comp_id2,
        name="Test Template 2",
        template="template2",
        created_by=mocked_user_response.id,
        children=[comp_id3, comp_id4],
        parents=[comp_id1],
    )
    comp3 = TemplateDTO(
        id=comp_id3,
        name="Test Template 3",
        template="template3",
        created_by=mocked_user_response.id,
        parents=[comp_id2],
    )
    comp4 = TemplateDTO(
        id=comp_id4,
        name="Test Template 4",
        template="template4",
        created_by=mocked_user_response.id,
        parents=[comp_id2],
    )
    return [
        comp1,
        comp2,
        comp3,
        comp4,
    ]
