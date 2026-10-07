from unittest.mock import AsyncMock, Mock

from application.workspaces.task import WorkspaceTask
from core.constants.model import ModelStatus


def make_task(status: ModelStatus) -> tuple[WorkspaceTask, AsyncMock]:
    task = WorkspaceTask.__new__(WorkspaceTask)
    task.workspace_instance = Mock(status=status)
    change_state = AsyncMock()
    task.change_state = change_state
    return task, change_state


async def test_make_failed_persists_error_status():
    task, change_state = make_task(ModelStatus.IN_PROGRESS)

    await task.make_failed()

    change_state.assert_awaited_once_with(ModelStatus.ERROR)


async def test_make_retry_persists_error_only_when_in_progress():
    running, running_change_state = make_task(ModelStatus.IN_PROGRESS)
    idle, idle_change_state = make_task(ModelStatus.READY)

    await running.make_retry(1, 3)
    await idle.make_retry(1, 3)

    running_change_state.assert_awaited_once_with(ModelStatus.ERROR)
    idle_change_state.assert_not_awaited()
