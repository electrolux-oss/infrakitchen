import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

from application.blueprints.model import Blueprint
from application.blueprints.schema import BlueprintCreate, BlueprintUpdate
from application.blueprints.service import BlueprintService
from application.workflows.schema import WiringRule, WorkflowRequest
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core import UserDTO

BLUEPRINT_ID = str(uuid4())


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_blueprint_service, mock_blueprint_crud):
        mock_blueprint_crud.get_by_id.return_value = None

        result = await mock_blueprint_service.get_by_id("invalid_id")

        assert result is None
        mock_blueprint_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(self, mock_blueprint_service, mock_blueprint_crud, mocked_blueprint):
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint

        result = await mock_blueprint_service.get_by_id(str(mocked_blueprint.id))

        assert result is not None
        assert result.id == mocked_blueprint.id
        assert result.name == mocked_blueprint.name
        assert result._entity_name == "blueprint"
        mock_blueprint_crud.get_by_id.assert_awaited_once_with(str(mocked_blueprint.id))

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, mock_blueprint_service, mock_blueprint_crud):
        error = RuntimeError("db failure")
        mock_blueprint_crud.get_by_id.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_blueprint_service.get_by_id(BLUEPRINT_ID)

        assert exc.value is error
        mock_blueprint_crud.get_by_id.assert_awaited_once_with(BLUEPRINT_ID)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_blueprint_service, mock_blueprint_crud):
        mock_blueprint_crud.get_all.return_value = []

        result = await mock_blueprint_service.get_all(limit=10)

        assert result == []
        mock_blueprint_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_blueprint_service, mock_blueprint_crud, mocked_blueprint):
        blueprint2 = Blueprint(
            id=uuid4(),
            name="Blueprint 2",
            description="Second blueprint",
            templates=[],
            wiring=[],
            default_variables={},
            configuration={},
            labels=[],
            status="enabled",
            revision_number=1,
            creator=mocked_blueprint.creator,
            created_by=mocked_blueprint.created_by,
            created_at=mocked_blueprint.created_at,
            updated_at=mocked_blueprint.updated_at,
        )
        mock_blueprint_crud.get_all.return_value = [mocked_blueprint, blueprint2]

        result = await mock_blueprint_service.get_all(limit=10, offset=0)

        assert len(result) == 2
        assert result[0].id == mocked_blueprint.id
        assert result[1].id == blueprint2.id
        mock_blueprint_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_blueprint_service, mock_blueprint_crud):
        error = RuntimeError("db failure")
        mock_blueprint_crud.get_all.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_blueprint_service.get_all(limit=10)

        assert exc.value is error
        mock_blueprint_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_blueprint_service, mock_blueprint_crud):
        mock_blueprint_crud.count.return_value = 3

        result = await mock_blueprint_service.count(filter={"status": "enabled"})

        assert result == 3
        mock_blueprint_crud.count.assert_awaited_once_with(filter={"status": "enabled"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_blueprint_service, mock_blueprint_crud):
        error = RuntimeError("db failure")
        mock_blueprint_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_blueprint_service.count(filter={"status": "enabled"})

        assert exc.value is error
        mock_blueprint_crud.count.assert_awaited_once_with(filter={"status": "enabled"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_blueprint,
        mocked_user,
        mocked_template,
    ):
        blueprint_create = BlueprintCreate(
            name="New Blueprint",
            description="A new blueprint",
            template_ids=[mocked_template.id],
        )

        mock_blueprint_crud.create.return_value = mocked_blueprint
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint

        user_dto = UserDTO.model_validate(mocked_user)
        result = await mock_blueprint_service.create(blueprint_create, user_dto)

        assert result.id == mocked_blueprint.id
        assert result.name == mocked_blueprint.name
        mock_blueprint_crud.create.assert_awaited_once()
        mock_revision_handler.handle_revision.assert_awaited_once_with(mocked_blueprint)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_blueprint.id, user_dto.id, ModelActions.CREATE
        )
        mock_event_sender.send_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_with_wiring(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mocked_blueprint,
        mocked_user,
    ):
        template_id_1 = uuid4()
        template_id_2 = uuid4()
        wiring = [
            WiringRule(
                source_template_id=template_id_1,
                source_output="vpc_id",
                target_template_id=template_id_2,
                target_variable="vpc_id",
            )
        ]
        blueprint_create = BlueprintCreate(
            name="Wired Blueprint",
            template_ids=[template_id_1, template_id_2],
            wiring=wiring,
        )

        mock_blueprint_crud.create.return_value = mocked_blueprint
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint

        user_dto = UserDTO.model_validate(mocked_user)
        result = await mock_blueprint_service.create(blueprint_create, user_dto)

        assert result.id == mocked_blueprint.id
        mock_blueprint_crud.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_error(self, mock_blueprint_service, mock_blueprint_crud, mocked_user, mocked_template):
        blueprint_create = BlueprintCreate(
            name="Fail Blueprint",
            template_ids=[mocked_template.id],
        )
        error = RuntimeError("create fail")
        mock_blueprint_crud.create.side_effect = error

        user_dto = UserDTO.model_validate(mocked_user)
        with pytest.raises(RuntimeError) as exc:
            await mock_blueprint_service.create(blueprint_create, user_dto)

        assert exc.value is error
        mock_blueprint_crud.create.assert_awaited_once()


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_blueprint,
        mocked_user,
    ):
        blueprint_update = BlueprintUpdate(name="Updated Blueprint")
        mock_blueprint_crud.update.return_value = mocked_blueprint

        user_dto = UserDTO.model_validate(mocked_user)
        result = await mock_blueprint_service.update(
            mocked_blueprint.id, blueprint_update, user_dto
        )

        assert result.id == mocked_blueprint.id
        mock_blueprint_crud.update.assert_awaited_once_with(
            mocked_blueprint.id, blueprint_update.model_dump(exclude_unset=True)
        )
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_blueprint.id, user_dto.id, ModelActions.UPDATE
        )
        mock_event_sender.send_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_not_found(self, mock_blueprint_service, mock_blueprint_crud, mocked_user):
        blueprint_update = BlueprintUpdate(name="Updated")
        mock_blueprint_crud.update.return_value = None

        user_dto = UserDTO.model_validate(mocked_user)
        with pytest.raises(EntityNotFound, match="Blueprint not found"):
            await mock_blueprint_service.update(BLUEPRINT_ID, blueprint_update, user_dto)

    @pytest.mark.asyncio
    async def test_update_error(self, mock_blueprint_service, mock_blueprint_crud, mocked_user):
        blueprint_update = BlueprintUpdate(name="Updated")
        error = RuntimeError("update fail")
        mock_blueprint_crud.update.side_effect = error

        user_dto = UserDTO.model_validate(mocked_user)
        with pytest.raises(RuntimeError) as exc:
            await mock_blueprint_service.update(BLUEPRINT_ID, blueprint_update, user_dto)

        assert exc.value is error


class TestPatch:
    @pytest.mark.asyncio
    async def test_patch_disable_success(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_blueprint,
        mock_user_dto,
    ):
        mocked_blueprint.status = ModelStatus.ENABLED
        patch_body = PatchBodyModel(action=ModelActions.DISABLE)
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint

        result = await mock_blueprint_service.patch(
            str(mocked_blueprint.id), patch_body, mock_user_dto
        )

        assert result.status == ModelStatus.DISABLED
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_blueprint.id, mock_user_dto.id, ModelActions.DISABLE
        )
        mock_event_sender.send_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_patch_enable_success(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_blueprint,
        mock_user_dto,
    ):
        mocked_blueprint.status = ModelStatus.DISABLED
        patch_body = PatchBodyModel(action=ModelActions.ENABLE)
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint

        result = await mock_blueprint_service.patch(
            str(mocked_blueprint.id), patch_body, mock_user_dto
        )

        assert result.status == ModelStatus.ENABLED
        mock_event_sender.send_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_patch_enable_already_enabled(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mocked_blueprint,
        mock_user_dto,
    ):
        mocked_blueprint.status = ModelStatus.ENABLED
        patch_body = PatchBodyModel(action=ModelActions.ENABLE)
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint

        with pytest.raises(EntityWrongState, match="Blueprint is already enabled"):
            await mock_blueprint_service.patch(
                str(mocked_blueprint.id), patch_body, mock_user_dto
            )

    @pytest.mark.asyncio
    async def test_patch_not_found(self, mock_blueprint_service, mock_blueprint_crud, mock_user_dto):
        patch_body = PatchBodyModel(action=ModelActions.DISABLE)
        mock_blueprint_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Blueprint not found"):
            await mock_blueprint_service.patch(BLUEPRINT_ID, patch_body, mock_user_dto)

    @pytest.mark.asyncio
    async def test_patch_unsupported_action(
        self, mock_blueprint_service, mock_blueprint_crud, mocked_blueprint, mock_user_dto
    ):
        patch_body = PatchBodyModel(action="unsupported_action")
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint

        with pytest.raises(ValueError, match="Action unsupported_action is not supported"):
            await mock_blueprint_service.patch(
                str(mocked_blueprint.id), patch_body, mock_user_dto
            )


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mock_audit_log_handler,
        mock_user_dto,
    ):
        blueprint_id = uuid4()
        mock_blueprint_crud.delete.return_value = None

        await mock_blueprint_service.delete(blueprint_id, mock_user_dto)

        mock_blueprint_crud.delete.assert_awaited_once_with(blueprint_id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            blueprint_id, mock_user_dto.id, ModelActions.DELETE
        )

    @pytest.mark.asyncio
    async def test_delete_error(self, mock_blueprint_service, mock_blueprint_crud, mock_user_dto):
        blueprint_id = uuid4()
        error = RuntimeError("delete fail")
        mock_blueprint_crud.delete.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_blueprint_service.delete(blueprint_id, mock_user_dto)

        assert exc.value is error
        mock_blueprint_crud.delete.assert_awaited_once_with(blueprint_id)


class TestGetActions:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status,user_permissions,expected_actions",
        [
            (ModelStatus.ENABLED, None, []),
            (ModelStatus.ENABLED, {}, []),
            (ModelStatus.ENABLED, {"api:blueprint": "read"}, []),
            (ModelStatus.ENABLED, {"api:blueprint": "admin"}, [ModelActions.EDIT, ModelActions.DISABLE]),
            (ModelStatus.DISABLED, {"api:blueprint": "admin"}, [ModelActions.DELETE, ModelActions.ENABLE]),
        ],
    )
    async def test_get_actions(
        self,
        status,
        user_permissions,
        expected_actions,
        mock_blueprint_service,
        mock_blueprint_crud,
        mocked_blueprint,
        mock_user_dto,
        mock_user_permissions,
        monkeypatch,
    ):
        mocked_blueprint.status = status
        mock_user_permissions(
            user_permissions,
            monkeypatch,
            "application.blueprints.service.user_api_permission",
        )
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint

        result = await mock_blueprint_service.get_actions(
            str(mocked_blueprint.id), mock_user_dto
        )

        assert sorted(result) == sorted(expected_actions)

    @pytest.mark.asyncio
    async def test_get_actions_not_found(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mock_user_dto,
        mock_user_permissions,
        monkeypatch,
    ):
        mock_user_permissions(
            {"api:blueprint": "admin"},
            monkeypatch,
            "application.blueprints.service.user_api_permission",
        )
        mock_blueprint_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Blueprint not found"):
            await mock_blueprint_service.get_actions(BLUEPRINT_ID, mock_user_dto)


class TestCreateWorkflow:
    @pytest.mark.asyncio
    async def test_create_workflow_success(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mock_workflow_service,
        mocked_blueprint,
        mocked_workflow,
        mock_user_dto,
    ):
        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint
        mock_workflow_service.create = AsyncMock(return_value=mocked_workflow)

        request = WorkflowRequest()
        result = await mock_blueprint_service.create_workflow(
            mocked_blueprint.id, request, mock_user_dto
        )

        assert result.id == mocked_workflow.id
        assert result.status == mocked_workflow.status
        mock_blueprint_crud.get_by_id.assert_awaited_once_with(mocked_blueprint.id)
        mock_workflow_service.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_workflow_blueprint_not_found(
        self, mock_blueprint_service, mock_blueprint_crud, mock_user_dto
    ):
        mock_blueprint_crud.get_by_id.return_value = None
        request = WorkflowRequest()

        with pytest.raises(EntityNotFound, match="Blueprint not found"):
            await mock_blueprint_service.create_workflow(BLUEPRINT_ID, request, mock_user_dto)

    @pytest.mark.asyncio
    async def test_create_workflow_with_wiring(
        self,
        mock_blueprint_service,
        mock_blueprint_crud,
        mock_workflow_service,
        mocked_blueprint,
        mocked_workflow,
        mocked_template,
        mock_user_dto,
    ):
        template_id_1 = mocked_template.id
        template_id_2 = uuid4()

        mocked_blueprint.wiring = [
            {
                "source_template_id": str(template_id_1),
                "source_output": "vpc_id",
                "target_template_id": str(template_id_2),
                "target_variable": "vpc_id",
            }
        ]
        # Add a second template mock
        from application.templates.model import Template

        template_2 = Template(
            id=template_id_2,
            name="Template 2",
            template="template2",
            status="enabled",
            creator=mocked_blueprint.creator,
            created_by=mocked_blueprint.created_by,
            revision_number=1,
            parents=[],
            children=[],
            abstract=False,
            created_at=mocked_blueprint.created_at,
            updated_at=mocked_blueprint.updated_at,
            cloud_resource_types=[],
            configuration={},
            labels=[],
            description="",
        )
        mocked_blueprint.templates = [mocked_template, template_2]

        mock_blueprint_crud.get_by_id.return_value = mocked_blueprint
        mock_workflow_service.create = AsyncMock(return_value=mocked_workflow)

        request = WorkflowRequest(
            variable_overrides={str(template_id_1): {"region": "us-east-1"}},
        )
        result = await mock_blueprint_service.create_workflow(
            mocked_blueprint.id, request, mock_user_dto
        )

        assert result.id == mocked_workflow.id
        mock_workflow_service.create.assert_awaited_once()

        # Verify the call body contains steps in correct order (source before target)
        call_args = mock_workflow_service.create.call_args
        body = call_args[0][0]
        assert len(body["steps"]) == 2
        step_template_ids = [s["template_id"] for s in body["steps"]]
        assert step_template_ids.index(str(template_id_1)) < step_template_ids.index(str(template_id_2))


class TestTopologicalSort:
    def test_no_wiring(self, mocked_template):
        tid1 = uuid4()
        tid2 = uuid4()
        result = BlueprintService._topological_sort([tid1, tid2], [])

        assert len(result) == 2
        assert {r[0] for r in result} == {tid1, tid2}

    def test_linear_chain(self):
        tid1 = uuid4()
        tid2 = uuid4()
        tid3 = uuid4()
        wiring = [
            WiringRule(
                source_template_id=tid1,
                source_output="out1",
                target_template_id=tid2,
                target_variable="in1",
            ),
            WiringRule(
                source_template_id=tid2,
                source_output="out2",
                target_template_id=tid3,
                target_variable="in2",
            ),
        ]

        result = BlueprintService._topological_sort([tid1, tid2, tid3], wiring)
        ids = [r[0] for r in result]

        assert ids.index(tid1) < ids.index(tid2)
        assert ids.index(tid2) < ids.index(tid3)

    def test_circular_dependency(self):
        tid1 = uuid4()
        tid2 = uuid4()
        wiring = [
            WiringRule(
                source_template_id=tid1,
                source_output="out",
                target_template_id=tid2,
                target_variable="in",
            ),
            WiringRule(
                source_template_id=tid2,
                source_output="out",
                target_template_id=tid1,
                target_variable="in",
            ),
        ]

        with pytest.raises(ValueError, match="Circular dependency"):
            BlueprintService._topological_sort([tid1, tid2], wiring)

    def test_parallel_levels(self):
        tid1 = uuid4()
        tid2 = uuid4()
        tid3 = uuid4()
        wiring = [
            WiringRule(
                source_template_id=tid1,
                source_output="out",
                target_template_id=tid2,
                target_variable="in",
            ),
            WiringRule(
                source_template_id=tid1,
                source_output="out",
                target_template_id=tid3,
                target_variable="in",
            ),
        ]

        result = BlueprintService._topological_sort([tid1, tid2, tid3], wiring)
        levels = {r[0]: r[1] for r in result}

        assert levels[tid1] == 0
        assert levels[tid2] == 1
        assert levels[tid3] == 1


class TestResolveVariablesForStep:
    def test_defaults_only(self):
        tid = uuid4()
        result = BlueprintService._resolve_variables_for_step(
            template_id=tid,
            default_variables={str(tid): {"region": "us-west-2"}},
            variable_overrides={},
            wiring_rules=[],
            completed_outputs={},
        )
        assert result == {"region": "us-west-2"}

    def test_override_takes_precedence(self):
        tid = uuid4()
        result = BlueprintService._resolve_variables_for_step(
            template_id=tid,
            default_variables={str(tid): {"region": "us-west-2"}},
            variable_overrides={str(tid): {"region": "eu-west-1"}},
            wiring_rules=[],
            completed_outputs={},
        )
        assert result == {"region": "eu-west-1"}

    def test_wired_output_applied(self):
        source_tid = uuid4()
        target_tid = uuid4()
        wiring = [
            WiringRule(
                source_template_id=source_tid,
                source_output="vpc_id",
                target_template_id=target_tid,
                target_variable="vpc_id",
            )
        ]
        result = BlueprintService._resolve_variables_for_step(
            template_id=target_tid,
            default_variables={},
            variable_overrides={},
            wiring_rules=wiring,
            completed_outputs={str(source_tid): {"vpc_id": "vpc-123"}},
        )
        assert result == {"vpc_id": "vpc-123"}

    def test_override_beats_wired(self):
        source_tid = uuid4()
        target_tid = uuid4()
        wiring = [
            WiringRule(
                source_template_id=source_tid,
                source_output="vpc_id",
                target_template_id=target_tid,
                target_variable="vpc_id",
            )
        ]
        result = BlueprintService._resolve_variables_for_step(
            template_id=target_tid,
            default_variables={},
            variable_overrides={str(target_tid): {"vpc_id": "vpc-override"}},
            wiring_rules=wiring,
            completed_outputs={str(source_tid): {"vpc_id": "vpc-123"}},
        )
        assert result == {"vpc_id": "vpc-override"}

    def test_no_matching_template(self):
        tid = uuid4()
        result = BlueprintService._resolve_variables_for_step(
            template_id=tid,
            default_variables={},
            variable_overrides={},
            wiring_rules=[],
            completed_outputs={},
        )
        assert result == {}
