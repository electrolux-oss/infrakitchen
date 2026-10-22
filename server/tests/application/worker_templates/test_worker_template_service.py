from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from application.providers.worker_providers.kubernetes_default_manifest import DEFAULT_POD_MANIFEST
from application.worker_templates.schema import (
    KubernetesWorkerConfig,
    WorkerTemplateCreate,
    WorkerTemplateResponse,
    WorkerTemplateUpdate,
)
import application.worker_templates.service as service_mod
from application.worker_templates.model import WorkerTemplate
from application.providers.worker_providers.kubernetes import KubernetesWorkerProvider
from core.adapters.provider_adapters import WorkerInstance
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.errors import AccessDenied, DependencyError, EntityExistsError, EntityNotFound, EntityWrongState


def make_create(**kwargs) -> WorkerTemplateCreate:
    data = {
        "name": "default",
        "provider": "kubernetes",
        "configuration": {"provider": "kubernetes", "pod_manifest": DEFAULT_POD_MANIFEST},
    }
    data.update(kwargs)
    return WorkerTemplateCreate.model_validate(data)


@pytest.fixture
def autoscaler_lock_held(monkeypatch):
    from contextlib import asynccontextmanager

    state = {"locked": True}

    @asynccontextmanager
    async def lock():
        yield state["locked"]

    monkeypatch.setattr(service_mod, "autoscaler_lock", lock)
    return state


class TestKubernetesConfigValidation:
    def test_default_manifest_is_valid(self):
        config = KubernetesWorkerConfig(pod_manifest=DEFAULT_POD_MANIFEST)
        assert config.provider == "kubernetes"

    @pytest.mark.parametrize(
        "manifest, error",
        [
            ("kind: [", "not valid YAML"),
            ("- a\n- b", "YAML mapping"),
            ("kind: Deployment\nspec:\n  containers: [{name: a}]", "kind: Pod"),
            ("kind: Pod\nspec: {}", "at least one container"),
            ("kind: Pod\nspec:\n  containers: []", "at least one container"),
        ],
    )
    def test_invalid_manifest(self, manifest, error):
        with pytest.raises(ValidationError, match=error):
            _ = KubernetesWorkerConfig(pod_manifest=manifest)

    def test_max_workers_must_be_positive(self):
        with pytest.raises(ValidationError):
            _ = make_create(max_workers=0)

    def test_update_requires_a_field(self):
        with pytest.raises(ValidationError):
            _ = WorkerTemplateUpdate.model_validate({})


class TestCreate:
    async def test_create_success(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        mock_audit_log_handler,
        mock_event_sender,
    ):
        mock_worker_template_crud.create.return_value = mocked_worker_template
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        result = await mock_worker_template_service.create_worker_template(make_create(), mock_user_dto)

        assert result is mocked_worker_template
        body = mock_worker_template_crud.create.await_args.args[0]
        assert body["created_by"] == mock_user_dto.id
        assert body["status"] == ModelStatus.ENABLED
        assert body["configuration"]["pod_manifest"] == DEFAULT_POD_MANIFEST
        mock_audit_log_handler.create_log.assert_awaited_once()
        mock_event_sender.send_event.assert_awaited_once()

    async def test_create_duplicate_name(self, mock_worker_template_service, mock_worker_template_crud, mock_user_dto):
        mock_worker_template_crud.count.return_value = 1

        with pytest.raises(EntityExistsError):
            _ = await mock_worker_template_service.create_worker_template(make_create(), mock_user_dto)
        mock_worker_template_crud.create.assert_not_awaited()


class TestUpdate:
    async def test_update_not_found(self, mock_worker_template_service, mock_worker_template_crud, mock_user_dto):
        mock_worker_template_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound):
            _ = await mock_worker_template_service.update_worker_template(
                "id", WorkerTemplateUpdate(max_workers=5), mock_user_dto
            )

    async def test_update_success(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        _ = await mock_worker_template_service.update_worker_template(
            str(mocked_worker_template.id), WorkerTemplateUpdate(max_workers=5), mock_user_dto
        )

        mock_worker_template_crud.update.assert_awaited_once_with(mocked_worker_template, {"max_workers": 5})

    async def test_changed_configuration_resets_backoff(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        monkeypatch,
    ):
        monkeypatch.setattr(KubernetesWorkerProvider, "list_instances", AsyncMock(return_value=[]))
        mocked_worker_template.spawn_failures = 3
        mocked_worker_template.spawn_blocked_until = datetime.now(UTC)
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template
        changed = KubernetesWorkerConfig(pod_manifest=DEFAULT_POD_MANIFEST, namespace="elsewhere")

        _ = await mock_worker_template_service.update_worker_template(
            str(mocked_worker_template.id), WorkerTemplateUpdate(configuration=changed), mock_user_dto
        )

        assert mocked_worker_template.spawn_failures == 0
        assert mocked_worker_template.spawn_blocked_until is None

    async def test_other_updates_keep_backoff(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mocked_worker_template.spawn_failures = 3
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        _ = await mock_worker_template_service.update_worker_template(
            str(mocked_worker_template.id), WorkerTemplateUpdate(max_workers=5), mock_user_dto
        )

        assert mocked_worker_template.spawn_failures == 3

    async def test_moving_template_with_workers_is_rejected(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        monkeypatch,
    ):
        instances = AsyncMock(return_value=[WorkerInstance(id="w-1", host="w-1", phase="running")])
        monkeypatch.setattr(KubernetesWorkerProvider, "list_instances", instances)
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template
        moved = KubernetesWorkerConfig(pod_manifest=DEFAULT_POD_MANIFEST, namespace="elsewhere")

        with pytest.raises(EntityWrongState, match="still has 1 worker"):
            _ = await mock_worker_template_service.update_worker_template(
                str(mocked_worker_template.id), WorkerTemplateUpdate(configuration=moved), mock_user_dto
            )
        mock_worker_template_crud.update.assert_not_awaited()

    async def test_moving_template_without_workers_is_allowed(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        monkeypatch,
    ):
        monkeypatch.setattr(KubernetesWorkerProvider, "list_instances", AsyncMock(return_value=[]))
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template
        moved = KubernetesWorkerConfig(pod_manifest=DEFAULT_POD_MANIFEST, namespace="elsewhere")

        _ = await mock_worker_template_service.update_worker_template(
            str(mocked_worker_template.id), WorkerTemplateUpdate(configuration=moved), mock_user_dto
        )
        mock_worker_template_crud.update.assert_awaited_once()

    async def test_update_without_changes(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        with pytest.raises(ValueError, match="No changes"):
            _ = await mock_worker_template_service.update_worker_template(
                str(mocked_worker_template.id), WorkerTemplateUpdate(max_workers=3), mock_user_dto
            )


class TestActions:
    async def test_disable_and_enable(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template
        template_id = str(mocked_worker_template.id)

        _ = await mock_worker_template_service.patch_action_worker_template(
            template_id, PatchBodyModel(action=ModelActions.DISABLE), mock_user_dto
        )
        assert mocked_worker_template.status == ModelStatus.DISABLED

        mocked_worker_template.last_error = "boom"
        mocked_worker_template.spawn_failures = 4
        mocked_worker_template.spawn_blocked_until = datetime.now(UTC)
        _ = await mock_worker_template_service.patch_action_worker_template(
            template_id, PatchBodyModel(action=ModelActions.ENABLE), mock_user_dto
        )
        assert mocked_worker_template.status == ModelStatus.ENABLED
        assert mocked_worker_template.last_error is None
        # enabling again is a new try
        assert mocked_worker_template.spawn_failures == 0
        assert mocked_worker_template.spawn_blocked_until is None

    async def test_enable_already_enabled(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        with pytest.raises(EntityWrongState):
            _ = await mock_worker_template_service.patch_action_worker_template(
                str(mocked_worker_template.id), PatchBodyModel(action=ModelActions.ENABLE), mock_user_dto
            )


class TestDefault:
    async def test_set_default(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        mock_event_sender,
    ):
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        result = await mock_worker_template_service.set_default(mocked_worker_template.id, mock_user_dto)

        assert result is mocked_worker_template
        # concurrent changes wait, so the unique index on is_default is never hit
        mock_worker_template_crud.lock_default.assert_awaited_once()
        mock_worker_template_crud.set_default.assert_awaited_once_with(mocked_worker_template)
        mock_event_sender.send_event.assert_awaited_once()
        # tasks waiting for static workers now go to the default template
        mock_worker_template_crud.retarget_queued_tasks.assert_awaited_once_with(entity=None, entity_id=None)

    async def test_set_default_notifies_about_previous_default(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        mock_event_sender,
    ):
        previous = WorkerTemplate(
            id=uuid4(),
            name="previous",
            description="",
            max_workers=1,
            idle_timeout_seconds=300,
            labels=[],
            revision_number=1,
            provider=mocked_worker_template.provider,
            configuration=mocked_worker_template.configuration,
            status=ModelStatus.ENABLED,
            is_default=True,
            creator=mocked_worker_template.creator,
            created_by=mocked_worker_template.created_by,
            created_at=mocked_worker_template.created_at,
            updated_at=mocked_worker_template.updated_at,
        )
        mock_worker_template_crud.get_default.return_value = previous
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        _ = await mock_worker_template_service.set_default(mocked_worker_template.id, mock_user_dto)

        sent = [call.args[0].id for call in mock_event_sender.send_event.await_args_list]
        assert sent == [mocked_worker_template.id, previous.id]
        mock_worker_template_crud.refresh.assert_any_await(previous)

    async def test_clear_default(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
    ):
        mocked_worker_template.is_default = True
        mock_worker_template_crud.get_default.return_value = mocked_worker_template

        assert await mock_worker_template_service.set_default(None, mock_user_dto) is None

        mock_worker_template_crud.set_default.assert_awaited_once_with(None)
        mock_worker_template_crud.retarget_queued_tasks.assert_awaited_once()

    async def test_disabled_template_cannot_be_default(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mocked_worker_template.status = ModelStatus.DISABLED
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        with pytest.raises(EntityWrongState):
            _ = await mock_worker_template_service.set_default(mocked_worker_template.id, mock_user_dto)
        mock_worker_template_crud.set_default.assert_not_awaited()

    async def test_default_cannot_be_disabled(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mocked_worker_template.is_default = True
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        with pytest.raises(EntityWrongState, match="global default"):
            _ = await mock_worker_template_service.patch_action_worker_template(
                str(mocked_worker_template.id), PatchBodyModel(action=ModelActions.DISABLE), mock_user_dto
            )
        assert mocked_worker_template.status == ModelStatus.ENABLED

    async def test_disabling_keeps_queued_tasks_on_the_template(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
    ):
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        _ = await mock_worker_template_service.patch_action_worker_template(
            str(mocked_worker_template.id), PatchBodyModel(action=ModelActions.DISABLE), mock_user_dto
        )

        assert mocked_worker_template.status == ModelStatus.DISABLED
        # they wait for the template instead of running on workers the entity did not choose
        mock_worker_template_crud.retarget_queued_tasks.assert_not_awaited()

    async def test_validate_selectable(
        self,
        monkeypatch,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
    ):
        import application.worker_templates.functions as functions_mod

        monkeypatch.setattr(
            functions_mod, "user_api_permission", AsyncMock(return_value={"api:worker_template": "read"})
        )
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        result = await mock_worker_template_service.validate_selectable(mocked_worker_template.id, mock_user_dto)
        assert result.id == mocked_worker_template.id

        mocked_worker_template.status = ModelStatus.DISABLED
        with pytest.raises(EntityWrongState):
            _ = await mock_worker_template_service.validate_selectable(mocked_worker_template.id, mock_user_dto)

        mock_worker_template_crud.get_by_id.return_value = None
        with pytest.raises(EntityNotFound):
            _ = await mock_worker_template_service.validate_selectable(uuid4(), mock_user_dto)

    async def test_selecting_needs_access_to_worker_templates(
        self,
        monkeypatch,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
    ):
        import application.worker_templates.functions as functions_mod

        monkeypatch.setattr(functions_mod, "user_api_permission", AsyncMock(return_value=None))
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        with pytest.raises(AccessDenied):
            _ = await mock_worker_template_service.validate_selectable(mocked_worker_template.id, mock_user_dto)

    @pytest.mark.parametrize(
        "status, is_default, expected",
        [
            (ModelStatus.ENABLED, False, [ModelActions.EDIT, "set_default", ModelActions.DISABLE]),
            (ModelStatus.ENABLED, True, [ModelActions.EDIT, "clear_default"]),
            (ModelStatus.DISABLED, False, [ModelActions.EDIT, ModelActions.DELETE, ModelActions.ENABLE]),
        ],
    )
    async def test_actions(self, monkeypatch, mock_user_dto, status, is_default, expected):
        import application.worker_templates.functions as functions_mod

        monkeypatch.setattr(
            functions_mod, "user_api_permission", AsyncMock(return_value={"api:worker_template": "admin"})
        )

        assert await functions_mod.get_worker_template_actions(mock_user_dto, status, is_default) == expected


class TestDelete:
    async def test_delete_blocked_while_selected(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mocked_worker_template.status = ModelStatus.DISABLED
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template
        resource_id = uuid4()
        mock_worker_template_crud.get_dependencies.return_value = [
            SimpleNamespace(id=resource_id, name="prod-db", type="resource")
        ]

        with pytest.raises(DependencyError) as error:
            await mock_worker_template_service.delete(str(mocked_worker_template.id), mock_user_dto)

        assert error.value.metadata == [{"id": resource_id, "name": "prod-db", "entityName": "resource"}]
        mock_worker_template_crud.delete.assert_not_awaited()

    async def test_delete_enabled_fails(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        with pytest.raises(EntityWrongState):
            await mock_worker_template_service.delete(str(mocked_worker_template.id), mock_user_dto)
        mock_worker_template_crud.delete.assert_not_awaited()

    async def test_delete_disabled(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        mock_revision_handler,
        monkeypatch,
        autoscaler_lock_held,
    ):
        mocked_worker_template.status = ModelStatus.DISABLED
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template
        provider = Mock(
            list_instances=AsyncMock(return_value=[WorkerInstance(id="done", host="done", phase="succeeded")])
        )
        provider.delete_instance = AsyncMock()
        monkeypatch.setattr(service_mod, "get_worker_provider", lambda _: provider)

        await mock_worker_template_service.delete(str(mocked_worker_template.id), mock_user_dto)

        provider.delete_instance.assert_awaited_once()
        mock_revision_handler.delete_revisions.assert_awaited_once()
        mock_worker_template_crud.delete.assert_awaited_once_with(mocked_worker_template)

    @pytest.mark.parametrize("phase", ["pending", "running"])
    async def test_delete_blocked_while_workers_live(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        monkeypatch,
        autoscaler_lock_held,
        phase,
    ):
        mocked_worker_template.status = ModelStatus.DISABLED
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template
        provider = Mock(list_instances=AsyncMock(return_value=[WorkerInstance(id="w", host="w", phase=phase)]))
        provider.delete_instance = AsyncMock()
        monkeypatch.setattr(service_mod, "get_worker_provider", lambda _: provider)

        with pytest.raises(EntityWrongState, match="1 running worker"):
            await mock_worker_template_service.delete(str(mocked_worker_template.id), mock_user_dto)

        provider.delete_instance.assert_not_awaited()
        mock_worker_template_crud.delete.assert_not_awaited()

    async def test_delete_refused_while_autoscaler_pass_runs(
        self,
        mock_worker_template_service,
        mock_worker_template_crud,
        mocked_worker_template,
        mock_user_dto,
        monkeypatch,
        autoscaler_lock_held,
    ):
        autoscaler_lock_held["locked"] = False
        mocked_worker_template.status = ModelStatus.DISABLED
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template
        monkeypatch.setattr(service_mod, "get_worker_provider", lambda _: Mock())

        with pytest.raises(EntityWrongState, match="try again"):
            await mock_worker_template_service.delete(str(mocked_worker_template.id), mock_user_dto)

        mock_worker_template_crud.delete.assert_not_awaited()


class TestProviders:
    def test_unknown_provider(self, mock_worker_template_service):
        with pytest.raises(ValueError, match="Unknown worker provider"):
            _ = mock_worker_template_service.get_default_configuration("nomad")

    def test_response_from_model(self, mocked_worker_template):
        response = WorkerTemplateResponse.model_validate(mocked_worker_template)
        assert isinstance(response.configuration, KubernetesWorkerConfig)
        assert response.configuration.namespace == "ik"

    async def test_worker_logs_found_by_host(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, monkeypatch
    ):
        import application.worker_templates.service as service_mod

        instance = WorkerInstance(id="w-1", host="w-1", phase="running")
        provider = Mock()
        provider.list_instances = AsyncMock(return_value=[instance])
        provider.get_logs = AsyncMock(return_value="line")
        monkeypatch.setattr(service_mod, "get_worker_provider", Mock(return_value=provider))
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        template_id = str(mocked_worker_template.id)
        assert await mock_worker_template_service.get_worker_logs(template_id, "w-1", 10) == "line"
        provider.get_logs.assert_awaited_once_with(instance, 10)
        mock_worker_template_crud.get_by_id.assert_awaited_once_with(template_id)

    async def test_worker_logs_unknown_host(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, monkeypatch
    ):
        import application.worker_templates.service as service_mod
        from core.errors import EntityNotFound

        provider = Mock()
        provider.list_instances = AsyncMock(return_value=[])
        monkeypatch.setattr(service_mod, "get_worker_provider", Mock(return_value=provider))
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        with pytest.raises(EntityNotFound):
            _ = await mock_worker_template_service.get_worker_logs(str(mocked_worker_template.id), "gone", 10)

    async def test_static_worker_has_no_logs(self, mock_worker_template_service, mock_worker_template_crud):
        from core.errors import EntityNotFound

        with pytest.raises(EntityNotFound):
            _ = await mock_worker_template_service.get_worker_logs(None, "static-host", 10)
        mock_worker_template_crud.get_by_id.assert_not_awaited()


class TestDescribeQueuePools:
    def statuses(self, template_id, pool_reason, waiting_reason=None):
        from core.task_queue.model import EntityQueueStatus, QueuedTaskInfo, TaskQueueStatus

        task = QueuedTaskInfo(
            id=uuid4(),
            entity="resource",
            status=TaskQueueStatus.QUEUED,
            created_at=datetime.now(UTC),
            worker_template_id=template_id,
            pool_reason=pool_reason,
            waiting_reason=waiting_reason or pool_reason,
        )
        return {uuid4(): EntityQueueStatus(tasks=[task])}, task

    @pytest.mark.parametrize(
        "status, last_error, core_reason, expected",
        [
            (ModelStatus.ENABLED, None, "spawning", "spawning"),
            (ModelStatus.ENABLED, "Worker w1 failed: OOMKilled", "spawning", "template_backoff"),
            # workers still run: their last error does not hold the task back
            (ModelStatus.ENABLED, "Worker w1 failed: OOMKilled", "workers_busy", "workers_busy"),
            (ModelStatus.DISABLED, None, "spawning", "template_disabled"),
        ],
    )
    async def test_template_state_explains_the_wait(
        self, mock_worker_template_service, mock_worker_template_crud, status, last_error, core_reason, expected
    ):
        template_id = uuid4()
        mock_worker_template_crud.get_pool_infos.return_value = [
            SimpleNamespace(id=template_id, name="burst", status=status, last_error=last_error)
        ]
        statuses, task = self.statuses(template_id, core_reason)

        await mock_worker_template_service.describe_queue_pools(statuses)

        assert task.worker_template_name == "burst"
        assert task.pool_reason == expected
        assert task.waiting_reason == expected

    async def test_other_waiting_reasons_are_kept(self, mock_worker_template_service, mock_worker_template_crud):
        template_id = uuid4()
        mock_worker_template_crud.get_pool_infos.return_value = [
            SimpleNamespace(id=template_id, name="burst", status=ModelStatus.DISABLED, last_error=None)
        ]
        statuses, task = self.statuses(template_id, "spawning", waiting_reason="cancel_window")

        await mock_worker_template_service.describe_queue_pools(statuses)

        assert task.waiting_reason == "cancel_window"
        assert task.pool_reason == "template_disabled"

    async def test_static_tasks_are_left_alone(self, mock_worker_template_service, mock_worker_template_crud):
        statuses, task = self.statuses(None, "no_workers")

        await mock_worker_template_service.describe_queue_pools(statuses)

        mock_worker_template_crud.get_pool_infos.assert_awaited_once_with(set())
        assert (task.worker_template_name, task.pool_reason) == (None, "no_workers")
