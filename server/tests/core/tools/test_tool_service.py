from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from core.tools import service as tool_service_module
from core.tools.schema import ToolDownloadRequest
from core.constants.model import ModelActions, ModelStatus
from core.errors import DependencyError, EntityExistsError, EntityNotFound, EntityWrongState


@pytest.fixture
def available_versions(monkeypatch):
    versions = AsyncMock(return_value=["1.6.0", "1.5.7"])
    monkeypatch.setattr(tool_service_module, "list_versions", versions)
    return versions


class TestRequestDownload:
    async def test_creates_tool_and_sends_task(
        self,
        tool_service,
        mock_tool_crud,
        mock_event_sender,
        mock_audit_log_handler,
        mocked_tool,
        mock_user_dto,
        available_versions,
    ):
        mocked_tool.status = ModelStatus.QUEUED
        mock_tool_crud.create.return_value = mocked_tool
        mock_tool_crud.get_by_id.return_value = mocked_tool

        result = await tool_service.request_download(
            ToolDownloadRequest(name="terraform", version="1.5.7", arch="amd64"), requester=mock_user_dto
        )

        assert result is mocked_tool
        body = mock_tool_crud.create.call_args.args[0]
        assert body["name"] == "terraform"
        assert body["executable"] == "terraform"
        assert body["arch"] == "amd64"
        assert body["status"] == ModelStatus.QUEUED
        assert body["source_url"].endswith("terraform_1.5.7_linux_amd64.zip")
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_tool.id, mock_user_dto.id, ModelActions.CREATE
        )
        mock_event_sender.send_task.assert_awaited_once_with(
            mocked_tool.id,
            requester=mock_user_dto,
            action=ModelActions.EXECUTE,
            trace_id=mock_audit_log_handler.trace_id,
            audit_log_id=mock_audit_log_handler.audit_log_id,
        )

    async def test_defaults_to_host_arch(
        self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, available_versions, monkeypatch
    ):
        monkeypatch.setattr(tool_service_module, "host_arch", lambda: "arm64")
        mock_tool_crud.create.return_value = mocked_tool
        mock_tool_crud.get_by_id.return_value = mocked_tool

        _ = await tool_service.request_download(
            ToolDownloadRequest(name="terraform", version="1.5.7"), requester=mock_user_dto
        )

        assert mock_tool_crud.create.call_args.args[0]["arch"] == "arm64"

    async def test_unknown_version(self, tool_service, mock_tool_crud, mock_user_dto, available_versions):
        with pytest.raises(ValueError, match="not available"):
            _ = await tool_service.request_download(
                ToolDownloadRequest(name="terraform", version="9.9.9"), requester=mock_user_dto
            )
        mock_tool_crud.create.assert_not_awaited()

    async def test_already_exists(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, available_versions):
        mock_tool_crud.get_one.return_value = mocked_tool

        with pytest.raises(EntityExistsError):
            _ = await tool_service.request_download(
                ToolDownloadRequest(name="terraform", version="1.5.7", arch="amd64"), requester=mock_user_dto
            )

    async def test_retries_failed_download(
        self,
        tool_service,
        mock_tool_crud,
        mock_event_sender,
        mock_audit_log_handler,
        mocked_tool,
        mock_user_dto,
        available_versions,
    ):
        mocked_tool.status = ModelStatus.ERROR
        mock_tool_crud.get_one.return_value = mocked_tool
        mock_tool_crud.update.return_value = mocked_tool
        mock_tool_crud.get_by_id.return_value = mocked_tool

        _ = await tool_service.request_download(
            ToolDownloadRequest(name="terraform", version="1.5.7", arch="amd64"), requester=mock_user_dto
        )

        mock_tool_crud.create.assert_not_awaited()
        assert mock_tool_crud.update.call_args.args[1]["status"] == ModelStatus.QUEUED
        mock_event_sender.send_task.assert_awaited_once()
        mock_audit_log_handler.create_log.assert_awaited_once_with(mocked_tool.id, mock_user_dto.id, ModelActions.RETRY)


class TestValidateReady:
    async def test_ready(self, tool_service, mock_tool_crud, mocked_tool):
        mock_tool_crud.get_by_id.return_value = mocked_tool
        result = await tool_service.validate_ready(mocked_tool.id)
        assert result.id == mocked_tool.id

    async def test_not_found(self, tool_service, mock_tool_crud):
        mock_tool_crud.get_by_id.return_value = None
        with pytest.raises(EntityNotFound):
            _ = await tool_service.validate_ready(uuid4())

    async def test_not_downloaded(self, tool_service, mock_tool_crud, mocked_tool):
        mocked_tool.status = ModelStatus.IN_PROGRESS
        mock_tool_crud.get_by_id.return_value = mocked_tool
        with pytest.raises(EntityWrongState):
            _ = await tool_service.validate_ready(mocked_tool.id)


class TestDelete:
    async def test_delete(
        self, tool_service, mock_tool_crud, mock_event_sender, mock_audit_log_handler, mocked_tool, mock_user_dto
    ):
        mocked_tool.status = ModelStatus.DISABLED
        mock_tool_crud.get_by_id.return_value = mocked_tool
        await tool_service.delete(mocked_tool.id, requester=mock_user_dto)
        mock_tool_crud.delete.assert_awaited_once_with(mocked_tool)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_tool.id, mock_user_dto.id, ModelActions.DELETE
        )
        mock_event_sender.send_event.assert_awaited_once()
        assert mock_event_sender.send_event.await_args.args[1] == ModelActions.DELETE

    async def test_used_by_entities(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto):
        mocked_tool.status = ModelStatus.DISABLED
        mock_tool_crud.get_by_id.return_value = mocked_tool
        dependency = SimpleNamespace(id=uuid4(), name="vpc", type="resource")
        mock_tool_crud.get_dependencies.return_value = [dependency]

        with pytest.raises(DependencyError) as exc:
            await tool_service.delete(mocked_tool.id, requester=mock_user_dto)

        assert exc.value.metadata == [{"id": dependency.id, "name": "vpc", "entityName": "resource"}]
        mock_tool_crud.delete.assert_not_awaited()

    @pytest.mark.parametrize("status", [ModelStatus.DONE, ModelStatus.ERROR, ModelStatus.IN_PROGRESS])
    async def test_not_disabled(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, status):
        mocked_tool.status = status
        mock_tool_crud.get_by_id.return_value = mocked_tool
        with pytest.raises(EntityWrongState, match="disabled"):
            await tool_service.delete(mocked_tool.id, requester=mock_user_dto)
        mock_tool_crud.delete.assert_not_awaited()


class TestSetDefault:
    async def test_set_default(
        self, tool_service, mock_tool_crud, mock_event_sender, mock_audit_log_handler, mocked_tool, mock_user_dto
    ):
        mock_tool_crud.get_by_id.return_value = mocked_tool

        result = await tool_service.set_default(mocked_tool.id, requester=mock_user_dto)

        assert result is mocked_tool
        mock_tool_crud.set_default.assert_awaited_once_with(mocked_tool)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_tool.id, mock_user_dto.id, ModelActions.UPDATE
        )
        mock_event_sender.send_event.assert_awaited_once()

    async def test_replaces_default(self, tool_service, mock_tool_crud, mock_event_sender, mocked_tool, mock_user_dto):
        previous = SimpleNamespace(**{**mocked_tool.__dict__, "id": uuid4(), "is_default": True})
        mock_tool_crud.get_by_id.return_value = mocked_tool
        mock_tool_crud.get_default.return_value = previous

        _ = await tool_service.set_default(mocked_tool.id, requester=mock_user_dto)

        mock_tool_crud.refresh.assert_awaited_once_with(previous)
        assert [call.args[0].id for call in mock_event_sender.send_event.await_args_list] == [
            mocked_tool.id,
            previous.id,
        ]

    async def test_clear_default(
        self, tool_service, mock_tool_crud, mock_event_sender, mock_audit_log_handler, mocked_tool, mock_user_dto
    ):
        mocked_tool.is_default = True
        mock_tool_crud.get_default.return_value = mocked_tool

        result = await tool_service.set_default(None, requester=mock_user_dto)

        assert result is None
        mock_tool_crud.set_default.assert_awaited_once_with(None)
        mock_tool_crud.refresh.assert_awaited_once_with(mocked_tool)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_tool.id, mock_user_dto.id, ModelActions.UPDATE
        )
        mock_event_sender.send_event.assert_awaited_once()

    async def test_clear_without_default(
        self, tool_service, mock_tool_crud, mock_event_sender, mock_audit_log_handler, mock_user_dto
    ):
        result = await tool_service.set_default(None, requester=mock_user_dto)

        assert result is None
        mock_tool_crud.set_default.assert_awaited_once_with(None)
        mock_event_sender.send_event.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()

    async def test_not_downloaded(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto):
        mocked_tool.status = ModelStatus.ERROR
        mock_tool_crud.get_by_id.return_value = mocked_tool
        with pytest.raises(EntityWrongState):
            _ = await tool_service.set_default(mocked_tool.id, requester=mock_user_dto)
        mock_tool_crud.set_default.assert_not_awaited()

    async def test_not_found(self, tool_service, mock_tool_crud, mock_user_dto):
        mock_tool_crud.get_by_id.return_value = None
        with pytest.raises(EntityNotFound):
            _ = await tool_service.set_default(uuid4(), requester=mock_user_dto)
        mock_tool_crud.set_default.assert_not_awaited()


class TestGetActions:
    @pytest.fixture
    def super_admin(self, monkeypatch):
        is_super_admin = AsyncMock(return_value=True)
        monkeypatch.setattr(tool_service_module, "user_is_super_admin", is_super_admin)
        return is_super_admin

    async def test_done(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, super_admin):
        mock_tool_crud.get_by_id.return_value = mocked_tool
        actions = await tool_service.get_actions(mocked_tool.id, requester=mock_user_dto)
        assert actions == ["set_default", ModelActions.DISABLE]

    async def test_default(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, super_admin):
        mocked_tool.is_default = True
        mock_tool_crud.get_by_id.return_value = mocked_tool
        actions = await tool_service.get_actions(mocked_tool.id, requester=mock_user_dto)
        assert actions == ["clear_default"]

    async def test_failed(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, super_admin):
        mocked_tool.status = ModelStatus.ERROR
        mock_tool_crud.get_by_id.return_value = mocked_tool
        actions = await tool_service.get_actions(mocked_tool.id, requester=mock_user_dto)
        assert actions == [ModelActions.DOWNLOAD, ModelActions.DISABLE]

    async def test_disabled(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, super_admin):
        mocked_tool.status = ModelStatus.DISABLED
        mock_tool_crud.get_by_id.return_value = mocked_tool
        actions = await tool_service.get_actions(mocked_tool.id, requester=mock_user_dto)
        assert actions == [ModelActions.ENABLE, ModelActions.DELETE]

    async def test_in_progress(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, super_admin):
        mocked_tool.status = ModelStatus.IN_PROGRESS
        mock_tool_crud.get_by_id.return_value = mocked_tool
        assert await tool_service.get_actions(mocked_tool.id, requester=mock_user_dto) == []

    async def test_not_super_admin(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, super_admin):
        super_admin.return_value = False
        mock_tool_crud.get_by_id.return_value = mocked_tool
        assert await tool_service.get_actions(mocked_tool.id, requester=mock_user_dto) == []

    async def test_not_found(self, tool_service, mock_tool_crud, mock_user_dto, super_admin):
        mock_tool_crud.get_by_id.return_value = None
        with pytest.raises(EntityNotFound):
            _ = await tool_service.get_actions(uuid4(), requester=mock_user_dto)


class TestPatchAction:
    @pytest.fixture(autouse=True)
    def crud_update(self, mock_tool_crud):
        async def update(tool, body):
            for key, value in body.items():
                setattr(tool, key, value)
            return tool

        mock_tool_crud.update.side_effect = update

    @pytest.mark.parametrize("status", [ModelStatus.DONE, ModelStatus.ERROR])
    async def test_disable(
        self,
        tool_service,
        mock_tool_crud,
        mock_event_sender,
        mock_audit_log_handler,
        mocked_tool,
        mock_user_dto,
        status,
    ):
        mocked_tool.status = status
        mock_tool_crud.get_by_id.return_value = mocked_tool

        result = await tool_service.patch_action(mocked_tool.id, ModelActions.DISABLE, requester=mock_user_dto)

        assert result.status == ModelStatus.DISABLED
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_tool.id, mock_user_dto.id, ModelActions.DISABLE
        )
        mock_event_sender.send_event.assert_awaited_once()

    async def test_disable_default(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto):
        mocked_tool.is_default = True
        mock_tool_crud.get_by_id.return_value = mocked_tool
        with pytest.raises(EntityWrongState, match="global default"):
            _ = await tool_service.patch_action(mocked_tool.id, ModelActions.DISABLE, requester=mock_user_dto)
        mock_tool_crud.update.assert_not_awaited()

    async def test_disable_in_progress(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto):
        mocked_tool.status = ModelStatus.IN_PROGRESS
        mock_tool_crud.get_by_id.return_value = mocked_tool
        with pytest.raises(EntityWrongState):
            _ = await tool_service.patch_action(mocked_tool.id, ModelActions.DISABLE, requester=mock_user_dto)

    @pytest.mark.parametrize(("sha256", "expected"), [("abc", ModelStatus.DONE), ("", ModelStatus.ERROR)])
    async def test_enable(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto, sha256, expected):
        mocked_tool.status = ModelStatus.DISABLED
        mocked_tool.sha256 = sha256
        mock_tool_crud.get_by_id.return_value = mocked_tool

        result = await tool_service.patch_action(mocked_tool.id, ModelActions.ENABLE, requester=mock_user_dto)

        assert result.status == expected

    async def test_enable_not_disabled(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto):
        mock_tool_crud.get_by_id.return_value = mocked_tool
        with pytest.raises(EntityWrongState, match="already enabled"):
            _ = await tool_service.patch_action(mocked_tool.id, ModelActions.ENABLE, requester=mock_user_dto)

    async def test_unsupported(self, tool_service, mock_tool_crud, mocked_tool, mock_user_dto):
        mock_tool_crud.get_by_id.return_value = mocked_tool
        with pytest.raises(ValueError, match="not supported"):
            _ = await tool_service.patch_action(mocked_tool.id, ModelActions.SYNC, requester=mock_user_dto)
