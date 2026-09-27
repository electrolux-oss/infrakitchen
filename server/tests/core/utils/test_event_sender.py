from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import core.utils.event_sender as event_sender_mod
from core.scheduler.model import JobType
from core.task_queue.model import TaskQueueKind
from core.utils.event_sender import EventSender


class TestEventSenderTasks:
    async def test_send_task_is_enqueued_on_flush(self, mock_user_dto, monkeypatch):
        enqueue = AsyncMock()
        send_message = AsyncMock()
        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)
        monkeypatch.setattr(event_sender_mod.RabbitMQConnection, "send_message", send_message)

        entity_id = uuid4()
        sender = EventSender(entity_name="resource")
        await sender.send_task(entity_id, requester=mock_user_dto, action="execute", trace_id="trace-1")

        enqueue.assert_not_awaited()
        await sender.flush()

        enqueue.assert_awaited_once()
        (items,) = enqueue.await_args_list[0].args
        assert items == [
            {
                "kind": TaskQueueKind.ENTITY_TASK,
                "entity": "resource",
                "entity_id": entity_id,
                "action": "execute",
                "payload": {"user": str(mock_user_dto.id), "trace_id": "trace-1", "audit_log_id": None},
                "created_by": mock_user_dto.id,
                "delay_seconds": 5,
            }
        ]
        send_message.assert_not_awaited()

    async def test_send_task_delay_can_be_skipped(self, mock_user_dto, monkeypatch):
        enqueue = AsyncMock()
        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)

        sender = EventSender(entity_name="workflow")
        await sender.send_task(uuid4(), requester=mock_user_dto, delay_seconds=0)
        await sender.flush()

        (items,) = enqueue.await_args_list[0].args
        assert items[0]["delay_seconds"] == 0

    async def test_extra_metadata_overrides_entity_controller(self, mock_user_dto, monkeypatch):
        enqueue = AsyncMock()
        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)

        sender = EventSender(entity_name="scheduled_entity_action")
        await sender.send_task(
            str(uuid4()),
            requester=mock_user_dto,
            extra_metadata={"entity_controller": "executor", "step_id": "step-1"},
        )
        await sender.flush()

        (items,) = enqueue.await_args_list[0].args
        assert items[0]["entity"] == "executor"
        assert isinstance(items[0]["entity_id"], UUID)
        assert items[0]["payload"]["step_id"] == "step-1"
        assert "entity_controller" not in items[0]["payload"]

    async def test_send_scheduler_job(self, monkeypatch):
        enqueue = AsyncMock()
        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)

        job_id = uuid4()
        sender = EventSender("scheduler_job")
        await sender.send_scheduler_job(job_id=job_id, job_type=JobType.SQL, job_script="DELETE FROM logs")
        await sender.flush()

        (items,) = enqueue.await_args_list[0].args
        assert items[0]["kind"] == TaskQueueKind.SCHEDULER_JOB
        assert items[0]["payload"] == {"job_id": str(job_id), "job_type": "SQL", "job_script": "DELETE FROM logs"}

    async def test_events_still_go_to_rabbitmq(self, mock_user_dto, monkeypatch):
        enqueue = AsyncMock()
        send_message = AsyncMock()
        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)
        monkeypatch.setattr(event_sender_mod.RabbitMQConnection, "send_message", send_message)

        sender = EventSender(entity_name="resource")
        await sender.send_reload_event("reload_scheduler_jobs")
        await sender.flush()

        send_message.assert_awaited_once()
        enqueue.assert_not_awaited()

    async def test_flush_clears_buffers(self, mock_user_dto, monkeypatch):
        enqueue = AsyncMock()
        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)

        sender = EventSender(entity_name="resource")
        await sender.send_task(uuid4(), requester=mock_user_dto)
        await sender.flush()
        await sender.flush()

        enqueue.assert_awaited_once()
