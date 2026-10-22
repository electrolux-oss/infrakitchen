from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from core.task_queue.model import EntityQueueStatus, QueuedTaskInfo, TaskQueueStatus, WaitingReason
from graphql_api.modules.task_queue.types import resolve_task_queue_status


class TestResolveTaskQueueStatus:
    @patch("graphql_api.modules.task_queue.types.get_task_queue_status_loader")
    async def test_maps_every_queued_task_field(self, mock_get_loader):
        template_id = uuid4()
        task = QueuedTaskInfo(
            id=uuid4(),
            entity="resource",
            action="execute",
            status=TaskQueueStatus.QUEUED,
            created_at=datetime.now(UTC),
            worker_template_id=template_id,
            worker_template_name="prod",
            waiting_reason=WaitingReason.SPAWNING,
        )
        mock_get_loader.return_value = Mock(
            load=AsyncMock(return_value=EntityQueueStatus(tasks=[task], workers_free=0, workers_online=1))
        )

        result = await resolve_task_queue_status(Mock(), "resource", uuid4())

        assert result is not None
        assert result.tasks[0].worker_template_id == template_id
        assert result.tasks[0].worker_template_name == "prod"
        assert result.tasks[0].waiting_reason == "spawning"
