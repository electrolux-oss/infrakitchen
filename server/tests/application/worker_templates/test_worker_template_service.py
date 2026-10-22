from unittest.mock import AsyncMock, Mock

import pytest
from pydantic import ValidationError

from application.worker_templates.providers.kubernetes_default_manifest import DEFAULT_POD_MANIFEST
from application.worker_templates.schema import (
    KubernetesWorkerConfig,
    WorkerTemplateCreate,
    WorkerTemplateResponse,
    WorkerTemplateUpdate,
)
import application.worker_templates.service as service_mod
from application.worker_templates.providers import WorkerInstance
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.errors import EntityExistsError, EntityNotFound, EntityWrongState


def make_create(**kwargs) -> WorkerTemplateCreate:
    data = {
        "name": "default",
        "provider": "kubernetes",
        "configuration": {"provider": "kubernetes", "pod_manifest": DEFAULT_POD_MANIFEST},
    }
    data.update(kwargs)
    return WorkerTemplateCreate.model_validate(data)


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
        _ = await mock_worker_template_service.patch_action_worker_template(
            template_id, PatchBodyModel(action=ModelActions.ENABLE), mock_user_dto
        )
        assert mocked_worker_template.status == ModelStatus.ENABLED
        assert mocked_worker_template.last_error is None

    async def test_enable_already_enabled(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, mock_user_dto
    ):
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        with pytest.raises(EntityWrongState):
            _ = await mock_worker_template_service.patch_action_worker_template(
                str(mocked_worker_template.id), PatchBodyModel(action=ModelActions.ENABLE), mock_user_dto
            )


class TestDelete:
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


class TestProviders:
    def test_list_providers(self, mock_worker_template_service):
        assert mock_worker_template_service.list_providers() == ["kubernetes", "docker"]

    def test_default_configuration(self, mock_worker_template_service):
        config = mock_worker_template_service.get_default_configuration("kubernetes")
        assert config["provider"] == "kubernetes"
        assert config["pod_manifest"] == DEFAULT_POD_MANIFEST

    def test_unknown_provider(self, mock_worker_template_service):
        with pytest.raises(ValueError, match="Unknown worker provider"):
            _ = mock_worker_template_service.get_default_configuration("nomad")

    def test_response_from_model(self, mocked_worker_template):
        response = WorkerTemplateResponse.model_validate(mocked_worker_template)
        assert isinstance(response.configuration, KubernetesWorkerConfig)
        assert response.configuration.namespace == "ik"

    async def test_list_instances_uses_provider(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, monkeypatch
    ):
        import application.worker_templates.service as service_mod

        provider = Mock()
        provider.list_instances = AsyncMock(return_value=[])
        monkeypatch.setattr(service_mod, "get_worker_provider", Mock(return_value=provider))
        mock_worker_template_crud.get_by_id.return_value = mocked_worker_template

        assert await mock_worker_template_service.list_instances(mocked_worker_template.id) == []
        provider.list_instances.assert_awaited_once()

    async def test_worker_logs_found_by_host(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, monkeypatch
    ):
        import application.worker_templates.service as service_mod

        instance = WorkerInstance(id="w-1", host="w-1", phase="running")
        provider = Mock()
        provider.list_instances = AsyncMock(return_value=[instance])
        provider.get_logs = AsyncMock(return_value="line")
        monkeypatch.setattr(service_mod, "get_worker_provider", Mock(return_value=provider))
        mock_worker_template_crud.get_all.return_value = [mocked_worker_template]

        assert await mock_worker_template_service.get_worker_logs("test", "w-1", 10) == "line"
        provider.get_logs.assert_awaited_once_with(instance, 10)

    async def test_worker_logs_unknown_host(
        self, mock_worker_template_service, mock_worker_template_crud, mocked_worker_template, monkeypatch
    ):
        import application.worker_templates.service as service_mod
        from core.errors import EntityNotFound

        provider = Mock()
        provider.list_instances = AsyncMock(return_value=[])
        monkeypatch.setattr(service_mod, "get_worker_provider", Mock(return_value=provider))
        mock_worker_template_crud.get_all.return_value = [mocked_worker_template]

        with pytest.raises(EntityNotFound):
            _ = await mock_worker_template_service.get_worker_logs("test", "gone", 10)
