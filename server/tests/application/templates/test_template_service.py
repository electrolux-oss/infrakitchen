import pytest
from unittest.mock import Mock

from pydantic import PydanticUserError
from uuid import uuid4

from application.templates.model import Template
from application.templates.schema import TemplateResponse, TemplateCreate, TemplateUpdate
from application.templates.service import TemplateService
from core import UserDTO
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.errors import DependencyError, EntityNotFound

TEMPLATE_ID = "abc123"


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


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_template_service, mock_template_crud):
        mock_template_crud.get_by_id.return_value = None

        result = await mock_template_service.get_by_id("invalid_id")

        assert result is None
        mock_template_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self, mock_template_service, mock_template_crud, monkeypatch, mocked_template, template_response
    ):
        mock_template_crud.get_by_id.return_value = mocked_template
        mocked_validate = Mock(return_value=template_response)
        monkeypatch.setattr(TemplateResponse, "model_validate", mocked_validate)

        result = await mock_template_service.get_by_id(TEMPLATE_ID)

        assert result.template == mocked_template.template

        mock_template_crud.get_by_id.assert_awaited_once_with(TEMPLATE_ID)
        mocked_validate.assert_called_once_with(mocked_template)

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, mock_template_service, mock_template_crud, monkeypatch, mocked_template):
        mock_template_crud.get_by_id.return_value = mocked_template

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(TemplateResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_template_service.get_by_id(TEMPLATE_ID)

        assert exc.value is error
        mock_template_crud.get_by_id.assert_awaited_once_with(TEMPLATE_ID)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_template_service, mock_template_crud):
        mock_template_crud.get_all.return_value = []

        result = await mock_template_service.get_all(limit=10)

        assert result == []
        mock_template_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_template_service, mock_template_crud, monkeypatch):
        templates = [
            Template(id=uuid4(), name="Test Template1", template="template1"),
            Template(id=uuid4(), name="Test Template2", template="template2"),
        ]
        mock_template_crud.get_all.return_value = templates

        template_response_1 = TemplateResponse(id=uuid4(), name="Test Template 1", template="template1")
        template_response_2 = TemplateResponse(id=uuid4(), name="Test Template 2", template="template2")

        def mock_model_validate_validate(arg):
            return template_response_1 if arg.template == "template1" else template_response_2

        monkeypatch.setattr(TemplateResponse, "model_validate", mock_model_validate_validate)

        result = await mock_template_service.get_all(limit=10, offset=0)

        assert result == [template_response_1, template_response_2]
        mock_template_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_template_service, mock_template_crud, monkeypatch, mocked_template):
        mock_template_crud.get_all.return_value = [mocked_template]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(TemplateResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_template_service.get_all(limit=10)

        assert exc.value is error
        mock_template_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_template_service, mock_template_crud):
        mock_template_crud.count.return_value = 1

        result = await mock_template_service.count(filter={"key": "value"})

        assert result == 1

        mock_template_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_template_service, mock_template_crud):
        error = RuntimeError("db failure")
        mock_template_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_template_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_template_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_template_service,
        mock_template_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_template,
        mocked_user,
    ):
        parent_template = mocked_template
        template_create = TemplateCreate(
            name="Test Template",
            template="template1",
            parents=[parent_template.id],
        )
        requester = mocked_user
        expected_created_template = mocked_template
        expected_created_template.id = uuid4()
        expected_created_template.name = "Test Template"
        expected_created_template.template = "template1"
        expected_created_template.parents = [parent_template]
        expected_created_template.created_by = requester.id

        mock_template_crud.create.return_value = expected_created_template
        mock_template_crud.get_by_id.return_value = expected_created_template

        result = await mock_template_service.create(template_create, requester)

        mock_template_crud.create.assert_awaited_once_with(
            {
                **template_create.model_dump(exclude_unset=True),
                "created_by": requester.id,
            }
        )

        assert result.status == ModelStatus.ENABLED

        mock_revision_handler.handle_revision.assert_awaited_once_with(expected_created_template)
        mock_audit_log_handler.create_log.assert_awaited_once_with(expected_created_template.id, requester.id, "create")
        mock_event_sender.send_event.assert_awaited_once_with(result, ModelActions.CREATE)

        assert result.template == "template1"
        assert result.parents[0].id == parent_template.id

    @pytest.mark.asyncio
    async def test_create_error(self, mock_template_service, mock_template_crud, mocked_user):
        template_create = Mock(spec=TemplateCreate)
        template_create.model_dump = Mock(return_value={})

        error = RuntimeError("create fail")
        mock_template_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_template_service.create(template_create, mocked_user)

        assert exc.value is error
        template_create.model_dump.assert_called_once_with(exclude_unset=True)
        mock_template_crud.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_error_disabled_template_parent(
        self, mock_template_crud, mocked_user, mocked_template, mock_template_service
    ):
        parent_template = mocked_template
        parent_template.status = ModelStatus.DISABLED

        template_create = TemplateCreate(
            name="Test Template",
            template="template1",
            parents=[parent_template.id],
        )

        mock_template_crud.get_all.return_value = [parent_template]

        with pytest.raises(DependencyError) as exc:
            await mock_template_service.create(template_create, mocked_user)

        assert str(exc.value) == "A template cannot have a disabled parent template"
        assert len(exc.value.metadata) == 1

    @pytest.mark.asyncio
    async def test_create_error_disabled_template_child(
        self, mock_template_crud, mocked_user, mocked_template, mock_template_service
    ):
        child_template = mocked_template
        child_template.status = ModelStatus.DISABLED

        template_create = TemplateCreate(
            name="Test Template",
            template="template1",
            children=[child_template.id],
        )

        mock_template_crud.get_all.return_value = [child_template]

        with pytest.raises(DependencyError) as exc:
            await mock_template_service.create(template_create, mocked_user)

        assert str(exc.value) == "A template cannot have a disabled child template"
        assert len(exc.value.metadata) == 1

    @pytest.mark.asyncio
    async def test_create_error_common_parent_and_children(
        self, mock_template_crud, mocked_user, mocked_template, mock_template_service
    ):
        child_template = mocked_template
        parent_template = mocked_template

        template_create = TemplateCreate(
            name="Test Template",
            template="template1",
            children=[child_template.id],
            parents=[parent_template.id],
        )

        mock_template_crud.get_all.return_value = [child_template]

        with pytest.raises(ValueError) as exc:
            await mock_template_service.create(template_create, mocked_user)

        assert str(exc.value) == "A template cannot be both a parent and a child of another template"


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_template_service,
        mock_template_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
    ):
        template_update = Mock(spec=TemplateUpdate)
        template_update_body = {"name": "Test Template", "description": "Template description"}
        template_id = uuid4()
        existing_template = Template(id=template_id, name="Test Template", template="template1")
        updated_template = Template(
            id=template_id,
            name="Test Template",
            template="template1",
            status=ModelStatus.ENABLED,
        )
        template_response = TemplateResponse(
            id=template_id,
            name="Test Template",
            template="template1",
            status=ModelStatus.ENABLED,
        )

        template_update.model_dump = Mock(return_value=template_update_body)
        mock_template_crud.get_by_id.return_value = existing_template
        mock_template_crud.update.return_value = updated_template
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        monkeypatch.setattr(TemplateResponse, "model_validate", Mock(return_value=template_response))

        result = await mock_template_service.update(
            template_id=template_id, template=template_update, requester=requester
        )

        template_update.model_dump.assert_called_once_with(exclude_unset=True)
        mock_template_crud.get_by_id.await_count = 2
        mock_template_crud.update.assert_awaited_once_with(existing_template, template_update_body)

        mock_audit_log_handler.create_log.assert_awaited_once_with(updated_template.id, requester.id, "update")
        response = TemplateResponse.model_validate(updated_template)
        mock_event_sender.send_event.assert_awaited_once_with(response, "update")

        assert result.status == ModelStatus.ENABLED

    @pytest.mark.asyncio
    async def test_update_template_does_not_exist(self, mock_template_service, mock_template_crud):
        template_update = Mock(spec=TemplateUpdate)
        requester = Mock(spec=UserDTO)

        mock_template_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Template not found"):
            await mock_template_service.update(template_id=TEMPLATE_ID, template=template_update, requester=requester)

    @pytest.mark.asyncio
    async def test_update_template_has_invalid_status(
        self, mock_template_service, mock_template_crud, mocked_template, mocked_user
    ):
        template_update = Mock(spec=TemplateUpdate)
        template_update_body = {
            "name": "Test Template",
            "description": "Template description",
            "parents": [],
            "children": [],
        }
        template_update.model_dump = Mock(return_value=template_update_body)
        existing_template = mocked_template

        mock_template_crud.get_by_id.return_value = existing_template

        with pytest.raises(ValueError):
            await mock_template_service.update(
                template_id=existing_template.id, template=template_update, requester=mocked_user
            )

    @pytest.mark.asyncio
    async def test_update_error(self, mock_template_service, mock_template_crud, mocked_template, mocked_user):
        template_update = Mock(spec=TemplateUpdate)
        template_update_body = {
            "name": "Test Template",
            "description": "Template description",
            "parents": [],
            "children": [],
        }
        template_update.model_dump = Mock(return_value=template_update_body)

        requester = mocked_user
        existing_template = mocked_template
        mock_template_crud.get_by_id.return_value = existing_template

        error = RuntimeError("update fail")
        mock_template_crud.update.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_template_service.update(
                template_id=existing_template.id, template=template_update, requester=requester
            )

        assert exc.value is error

    @pytest.mark.asyncio
    async def test_parents_and_children_error(
        self, mock_template_service, mock_template_crud, mocked_template, mocked_user
    ):
        parent_id = uuid4()
        child_id = uuid4()
        template_update = Mock(spec=TemplateUpdate)
        template_update_body = {
            "name": "Test Template",
            "description": "Template description",
            "parents": [parent_id],
            "children": [child_id, parent_id],
        }
        template_update.model_dump = Mock(return_value=template_update_body)

        requester = mocked_user
        existing_template = mocked_template
        mock_template_crud.get_by_id.return_value = existing_template

        with pytest.raises(ValueError) as exc:
            await mock_template_service.update(
                template_id=existing_template.id, template=template_update, requester=requester
            )

        assert str(exc.value) == "A template cannot be both a parent and a child of another template"


class TestPatch:
    @pytest.mark.asyncio
    async def test_patch_success_with_status_disable(
        self, mock_template_service, mock_template_crud, mock_audit_log_handler, mock_event_sender, monkeypatch
    ):
        patch_body = PatchBodyModel(action=ModelActions.DISABLE)
        existing_template = Template(
            id=uuid4(),
            name="Test Template",
            template="template1",
            status=ModelStatus.ENABLED,
        )
        template_response = TemplateResponse(
            id=uuid4(), name="Test Template", template="template1", status=ModelStatus.DISABLED
        )

        mock_template_crud.get_by_id.return_value = existing_template
        mock_template_crud.get_dependencies.return_value = []
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        monkeypatch.setattr(TemplateResponse, "model_validate", Mock(return_value=template_response))

        result = await mock_template_service.patch(template_id=TEMPLATE_ID, body=patch_body, requester=requester)

        mock_template_crud.get_by_id.assert_awaited_once_with(TEMPLATE_ID)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_template.id, requester.id, ModelActions.DISABLE
        )
        response = TemplateResponse.model_validate(existing_template)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DISABLE)

        assert result.status == ModelStatus.DISABLED

    @pytest.mark.asyncio
    async def test_patch_success_with_status_enable(
        self, mock_template_service, mock_template_crud, mock_audit_log_handler, mock_event_sender, monkeypatch
    ):
        patch_body = PatchBodyModel(action=ModelActions.ENABLE)
        existing_template = Template(
            id=uuid4(),
            name="Test Template",
            template="template1",
            status=ModelStatus.DISABLED,
        )
        template_response = TemplateResponse(
            id=uuid4(), name="Test Template", template="template1", status=ModelStatus.ENABLED
        )

        mock_template_crud.get_by_id.return_value = existing_template
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        monkeypatch.setattr(TemplateResponse, "model_validate", Mock(return_value=template_response))

        result = await mock_template_service.patch(template_id=TEMPLATE_ID, body=patch_body, requester=requester)

        mock_template_crud.get_by_id.assert_awaited_once_with(TEMPLATE_ID)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_template.id, requester.id, ModelActions.ENABLE
        )
        response = TemplateResponse.model_validate(existing_template)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.ENABLE)

        assert result.status == ModelStatus.ENABLED

    @pytest.mark.asyncio
    async def test_patch_template_does_not_exist(self, mock_template_service, mock_template_crud):
        patch_body = PatchBodyModel(action=ModelActions.DISABLE)
        requester = Mock(spec=UserDTO)

        mock_template_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Template not found"):
            await mock_template_service.patch(template_id=TEMPLATE_ID, body=patch_body, requester=requester)


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(self, mock_template_service, mock_template_crud):
        existing_template = Template(
            id=uuid4(),
            name="Test Template",
            template="template1",
            status=ModelStatus.DISABLED,
        )
        mock_template_crud.get_by_id.return_value = existing_template
        requester = Mock(spec=UserDTO)

        await mock_template_service.delete(template_id=TEMPLATE_ID, requester=requester)

        mock_template_crud.get_by_id.assert_awaited_once_with(TEMPLATE_ID)
        mock_template_crud.delete.assert_awaited_once_with(existing_template)

    @pytest.mark.asyncio
    async def test_delete_error_has_children(
        self, mock_template_service, mock_template_crud, mocked_template, mocked_user
    ):
        dependency_template = Mock(
            id=uuid4(),
            name="Dependency Template",
            type="resource",
        )

        mocked_template.status = ModelStatus.DISABLED
        mock_template_crud.get_by_id.return_value = mocked_template
        mock_template_crud.get_dependencies.return_value = [dependency_template]
        requester = mocked_user

        with pytest.raises(DependencyError) as exc:
            await mock_template_service.delete(template_id=mocked_template.id, requester=requester)

        assert str(exc.value) == "Cannot delete template, it is used by 1 entities"
        assert len(exc.value.metadata) == 1

        mock_template_crud.get_by_id.assert_awaited_once_with(mocked_template.id)

    @pytest.mark.asyncio
    async def test_delete_template_does_not_exist(self, mock_template_service, mock_template_crud):
        requester = Mock(spec=UserDTO)

        mock_template_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Template not found"):
            await mock_template_service.delete(template_id=TEMPLATE_ID, requester=requester)


class TestGetTree:
    @pytest.mark.asyncio
    async def test_get_tree_success(self, mock_template_service, mock_template_crud, monkeypatch):
        raw_node = {
            "id": f"{uuid4()}",
            "name": "Test Template",
            "state": "state",
            "status": "status",
            "children": [],
            "parent_id": None,
        }
        tree = [raw_node]
        mock_template_crud.get_tree_to_parent.return_value = tree

        result = await mock_template_service.get_tree(template_id=TEMPLATE_ID, direction="parents")

        mock_template_crud.get_tree_to_parent.assert_awaited_once_with(TEMPLATE_ID)
        assert result.name == "Test Template"

    @pytest.mark.asyncio
    async def test_get_tree_does_not_exist(self, mock_template_service, mock_template_crud):
        mock_template_crud.get_tree_to_parent.return_value = None

        with pytest.raises(EntityNotFound, match="Template not found"):
            await mock_template_service.get_tree(template_id=TEMPLATE_ID, direction="parents")
