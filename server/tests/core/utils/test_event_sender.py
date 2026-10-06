from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import core.utils.event_sender as event_sender_mod
from core.constants.model import EventType
from core.notifications.model import NotificationEvent
from core.pubsub import MAX_PAYLOAD_BYTES, encoded_size
from core.scheduler.model import JobType
from core.task_queue.model import TaskQueueKind
from core.utils.event_sender import EventSender, fit_event_body


class TestEventSenderTasks:
    async def test_send_task_is_enqueued_on_flush(self, mock_user_dto, monkeypatch):
        enqueue = AsyncMock()
        send_message = AsyncMock()
        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)
        monkeypatch.setattr(event_sender_mod.pubsub, "publish_many", send_message)

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

    async def test_events_are_published_on_the_events_topic(self, mock_user_dto, monkeypatch):
        enqueue = AsyncMock()
        published: list[tuple[str, dict[str, Any]]] = []

        async def publish_many(messages):
            published.extend(messages)

        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)
        monkeypatch.setattr(event_sender_mod.pubsub, "publish_many", publish_many)

        sender = EventSender(entity_name="resource")
        await sender.send_reload_event("reload_scheduler_jobs")
        await sender.flush()

        assert published == [
            ("events", {"_metadata": {"event": "reload_scheduler_jobs", "_message_type": "event"}}),
        ]
        enqueue.assert_not_awaited()

    async def test_publish_failure_does_not_fail_flush(self, monkeypatch):
        monkeypatch.setattr(event_sender_mod.pubsub, "publish_many", AsyncMock(side_effect=OSError("db down")))

        sender = EventSender(entity_name="resource")
        await sender.send_reload_event("reload_policies")
        await sender.flush()

    async def test_notifications_are_enqueued_on_flush(self, monkeypatch):
        enqueue = AsyncMock()
        monkeypatch.setattr(event_sender_mod.notification_outbox, "enqueue_notifications", enqueue)
        event = NotificationEvent(
            event_type=EventType.UPDATE, entity_type="resource", title="t", status="info", message="m"
        )

        sender = EventSender(entity_name="resource")
        await sender.send_notification(event)

        enqueue.assert_not_awaited()
        await sender.flush()
        enqueue.assert_awaited_once_with([event])

    async def test_flush_clears_buffers(self, mock_user_dto, monkeypatch):
        enqueue = AsyncMock()
        monkeypatch.setattr(event_sender_mod.task_queue_enqueue, "enqueue_tasks", enqueue)

        sender = EventSender(entity_name="resource")
        await sender.send_task(uuid4(), requester=mock_user_dto)
        await sender.flush()
        await sender.flush()

        enqueue.assert_awaited_once()


class TestFitEventBody:
    def test_small_body_is_unchanged(self):
        body = {"id": "1", "status": "ready", "_metadata": {"event": "update"}}
        assert fit_event_body(body) is body

    def test_large_body_keeps_small_top_level_fields(self):
        body = {
            "id": "1",
            "_entity_name": "resource",
            "status": "ready",
            "revision_number": 3,
            "variables": [{"name": f"v{i}", "value": "x" * 100} for i in range(200)],
            "description": "y" * 10_000,
            "_metadata": {"event": "update"},
        }

        fitted = fit_event_body(body)

        assert encoded_size(fitted) < MAX_PAYLOAD_BYTES
        assert fitted == {
            "id": "1",
            "_entity_name": "resource",
            "status": "ready",
            "revision_number": 3,
            "_metadata": {"event": "update", "truncated": True},
        }

    def test_many_small_fields_fall_back_to_identity(self):
        body: dict[str, Any] = {f"field_{i}": "z" * 400 for i in range(100)}
        body |= {"id": "1", "_entity_name": "resource", "_metadata": {"event": "update"}}

        fitted = fit_event_body(body)

        assert fitted == {"id": "1", "_entity_name": "resource", "_metadata": {"event": "update", "truncated": True}}
