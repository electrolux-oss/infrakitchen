from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from core.task_queue.crud import TaskQueueCRUD
from core.task_queue.model import TaskQueueItem, TaskQueueKind, TaskQueueStatus, WaitingReason
from core.task_queue.service import TaskQueueService


@pytest.fixture
def mock_crud():
    crud = Mock(spec=TaskQueueCRUD)
    for name in (
        "notify",
        "claim",
        "claim_expired",
        "extend_lease",
        "finish",
        "requeue",
        "delete_finished_before",
        "cancel_queued",
        "queue_counts",
        "worker_counts",
        "commit",
        "rollback",
    ):
        setattr(crud, name, AsyncMock())
    return crud


@pytest.fixture
def service(mock_crud):
    return TaskQueueService(crud=mock_crud)


def make_db_item() -> TaskQueueItem:
    return TaskQueueItem(
        id=uuid4(),
        kind=TaskQueueKind.ENTITY_TASK,
        entity="resource",
        entity_id=uuid4(),
        action="execute",
        payload={"user": str(uuid4())},
        status=TaskQueueStatus.RUNNING,
        priority=0,
        attempts=1,
        retries=0,
        max_retries=3,
        created_at=datetime.now(UTC),
    )


class TestClaim:
    async def test_claim_returns_dto(self, service, mock_crud):
        db_item = make_db_item()
        mock_crud.claim.return_value = db_item
        worker_id = uuid4()

        result = await service.claim(worker_id, lease_seconds=90)

        assert result is not None
        assert result.id == db_item.id
        assert result.entity == "resource"
        mock_crud.claim.assert_awaited_once_with(worker_id, 90)
        mock_crud.commit.assert_awaited_once()

    async def test_claim_returns_none_when_queue_is_empty(self, service, mock_crud):
        mock_crud.claim.return_value = None

        assert await service.claim(uuid4(), lease_seconds=90) is None

    async def test_claim_retries_once_after_entity_race(self, service, mock_crud):
        db_item = make_db_item()
        mock_crud.claim.side_effect = [IntegrityError("stmt", {}, Exception("duplicate")), db_item]

        result = await service.claim(uuid4(), lease_seconds=90)

        assert result is not None and result.id == db_item.id
        mock_crud.rollback.assert_awaited_once()
        assert mock_crud.claim.await_count == 2


class TestLifecycle:
    async def test_heartbeat_reports_lost_lease(self, service, mock_crud):
        mock_crud.extend_lease.return_value = False

        assert await service.heartbeat(uuid4(), uuid4(), 90) is False

    async def test_complete(self, service, mock_crud):
        task_id, worker_id = uuid4(), uuid4()
        mock_crud.finish.return_value = True

        assert await service.complete(task_id, worker_id) is True

        mock_crud.finish.assert_awaited_once_with(task_id, worker_id, TaskQueueStatus.DONE, error=None)
        mock_crud.commit.assert_awaited_once()

    async def test_fail_records_error(self, service, mock_crud):
        task_id, worker_id = uuid4(), uuid4()
        mock_crud.finish.return_value = True

        await service.fail(task_id, worker_id, "boom")

        mock_crud.finish.assert_awaited_once_with(task_id, worker_id, TaskQueueStatus.FAILED, error="boom")

    async def test_finish_reports_lost_ownership(self, service, mock_crud):
        mock_crud.finish.return_value = False

        assert await service.complete(uuid4(), uuid4()) is False

    async def test_requeue_notifies_workers(self, service, mock_crud):
        task_id, worker_id = uuid4(), uuid4()
        mock_crud.requeue.return_value = True

        assert await service.requeue(task_id, worker_id, 5.0) is True

        mock_crud.requeue.assert_awaited_once_with(task_id, worker_id, 5.0)
        mock_crud.notify.assert_awaited_once()
        mock_crud.commit.assert_awaited_once()

    async def test_requeue_without_ownership_does_not_notify(self, service, mock_crud):
        mock_crud.requeue.return_value = False

        assert await service.requeue(uuid4(), uuid4(), 5.0) is False
        mock_crud.notify.assert_not_awaited()

    async def test_purge_finished(self, service, mock_crud):
        mock_crud.delete_finished_before.return_value = 7

        assert await service.purge_finished(older_than_days=14) == 7
        before = mock_crud.delete_finished_before.await_args.args[0]
        assert datetime.now(UTC) - before >= timedelta(days=14)


class TestCancelQueued:
    async def test_cancel_returns_dto(self, service, mock_crud):
        db_item = make_db_item()
        db_item.status = TaskQueueStatus.CANCELLED
        mock_crud.cancel_queued.return_value = db_item

        result = await service.cancel_queued(db_item.id, reason="Cancelled by admin")

        assert result is not None
        assert result.status == TaskQueueStatus.CANCELLED
        mock_crud.cancel_queued.assert_awaited_once_with(db_item.id, "Cancelled by admin")
        # The caller commits together with the entity status change
        mock_crud.commit.assert_not_awaited()

    async def test_cancel_returns_none_when_already_claimed(self, service, mock_crud):
        mock_crud.cancel_queued.return_value = None

        assert await service.cancel_queued(uuid4(), reason="Cancelled by admin") is None


class TestStats:
    async def test_stats(self, service, mock_crud):
        now = datetime.now(UTC)
        mock_crud.queue_counts.return_value = {
            "queued": 4,
            "delayed": 1,
            "running": 2,
            "oldest": now - timedelta(seconds=30),
            "now": now,
        }
        mock_crud.worker_counts.return_value = {"free": 1, "busy": 2, "offline": 3}

        stats = await service.stats(worker_alive_seconds=90)

        assert stats.queued == 4
        assert stats.delayed == 1
        assert stats.running == 2
        assert stats.oldest_queued_seconds == 30.0
        assert (stats.workers_free, stats.workers_busy, stats.workers_offline) == (1, 2, 3)

    async def test_stats_without_backlog(self, service, mock_crud):
        mock_crud.queue_counts.return_value = {
            "queued": 0,
            "delayed": 0,
            "running": 0,
            "oldest": None,
            "now": datetime.now(UTC),
        }
        mock_crud.worker_counts.return_value = {"free": 0, "busy": 0, "offline": 0}

        stats = await service.stats(worker_alive_seconds=90)

        assert stats.oldest_queued_seconds == 0.0


class TestEntityQueueStatus:
    def row(self, entity_id, status, entity="resource", available_at=None, position=None):
        item = make_db_item()
        item.entity = entity
        item.entity_id = entity_id
        item.status = status
        item.available_at = available_at or datetime.now(UTC) - timedelta(seconds=5)
        return (item, "worker-host" if status == TaskQueueStatus.RUNNING else None, "user1", position)

    def setup_crud(self, mock_crud, rows, free=1, busy=0):
        mock_crud.get_active_for_entities = AsyncMock(return_value=rows)
        mock_crud.db_now = AsyncMock(return_value=datetime.now(UTC))
        mock_crud.worker_counts.return_value = {"free": free, "busy": busy, "offline": 0}

    async def test_returns_empty_without_active_tasks(self, service, mock_crud):
        self.setup_crud(mock_crud, [])

        assert await service.get_entity_queue_status(["resource"], [uuid4()], 90) == {}
        mock_crud.worker_counts.assert_not_awaited()

    async def test_groups_tasks_by_entity(self, service, mock_crud):
        e1, e2 = uuid4(), uuid4()
        self.setup_crud(
            mock_crud,
            [
                self.row(e1, TaskQueueStatus.RUNNING),
                self.row(e1, TaskQueueStatus.QUEUED, position=2),
                self.row(e2, TaskQueueStatus.QUEUED, position=1),
            ],
            free=2,
            busy=1,
        )

        result = await service.get_entity_queue_status(["resource"], [e1, e2], 90)

        assert [t.status for t in result[e1].tasks] == [TaskQueueStatus.RUNNING, TaskQueueStatus.QUEUED]
        assert result[e1].tasks[0].worker_host == "worker-host"
        assert result[e1].tasks[0].waiting_reason is None
        assert result[e1].tasks[1].position == 2
        assert (result[e1].workers_free, result[e1].workers_online) == (2, 3)
        assert len(result[e2].tasks) == 1

    @pytest.mark.parametrize(
        "free,busy,running_entity,delayed,expected",
        [
            (1, 0, "resource", False, WaitingReason.ENTITY_BUSY),
            (1, 0, None, True, WaitingReason.CANCEL_WINDOW),
            (0, 0, None, False, WaitingReason.NO_WORKERS),
            (0, 2, None, False, WaitingReason.WORKERS_BUSY),
            (1, 0, None, False, WaitingReason.PENDING_PICKUP),
            # a running workspace sync doesn't block a resource task
            (1, 0, "workspace", False, WaitingReason.PENDING_PICKUP),
        ],
    )
    async def test_waiting_reason(self, service, mock_crud, free, busy, running_entity, delayed, expected):
        entity_id = uuid4()
        rows = []
        if running_entity:
            rows.append(self.row(entity_id, TaskQueueStatus.RUNNING, entity=running_entity))
        available_at = datetime.now(UTC) + timedelta(minutes=1) if delayed else None
        rows.append(self.row(entity_id, TaskQueueStatus.QUEUED, available_at=available_at, position=1))
        self.setup_crud(mock_crud, rows, free=free, busy=busy)

        result = await service.get_entity_queue_status(["resource", "workspace"], [entity_id], 90)

        assert result[entity_id].tasks[-1].waiting_reason == expected

    async def test_retried_task_waits_for_retry_delay(self, service, mock_crud):
        entity_id = uuid4()
        row = self.row(entity_id, TaskQueueStatus.QUEUED, available_at=datetime.now(UTC) + timedelta(minutes=1))
        row[0].retries = 1
        self.setup_crud(mock_crud, [row])

        result = await service.get_entity_queue_status(["resource"], [entity_id], 90)

        assert result[entity_id].tasks[0].waiting_reason == WaitingReason.RETRY_DELAY
