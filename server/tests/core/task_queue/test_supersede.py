from unittest.mock import AsyncMock
from uuid import uuid4

import core.task_queue.notifications as notifications_mod
from core.task_queue.enqueue import collapse_batch, supersede_key, to_row
from core.task_queue.model import SupersededTask, TaskQueueKind
from core.task_queue.notifications import notify_superseded


def task(entity="resource", entity_id=None, action="execute", **payload):
    return {
        "kind": TaskQueueKind.ENTITY_TASK,
        "entity": entity,
        "entity_id": entity_id or uuid4(),
        "action": action,
        "payload": payload,
    }


class TestSupersedeKey:
    def test_same_entity_same_key_regardless_of_action(self):
        entity_id = uuid4()
        assert supersede_key(task(entity_id=entity_id, action="execute")) == supersede_key(
            task(entity_id=entity_id, action="dryrun")
        )

    def test_entity_type_is_part_of_key(self):
        entity_id = uuid4()
        assert supersede_key(task("resource", entity_id)) != supersede_key(task("workspace", entity_id))

    def test_workflow_steps_are_distinct(self):
        entity_id = uuid4()
        assert supersede_key(task("workflow", entity_id, step_id="a")) != supersede_key(
            task("workflow", entity_id, step_id="b")
        )
        assert supersede_key(task("workflow", entity_id)) != supersede_key(task("workflow", entity_id, step_id="a"))

    def test_workflow_resource_callbacks_are_distinct(self):
        """Parallel resources finishing must each resume the workflow."""
        entity_id = uuid4()
        assert supersede_key(task("workflow", entity_id, resource_id="r1")) != supersede_key(
            task("workflow", entity_id, resource_id="r2")
        )
        assert supersede_key(task("workflow", entity_id)) != supersede_key(
            task("workflow", entity_id, resource_id="r1")
        )
        assert supersede_key(task("workflow", entity_id, resource_id="r1")) == supersede_key(
            task("workflow", entity_id, resource_id="r1")
        )

    def test_step_and_resource_targets_do_not_collide(self):
        entity_id = uuid4()
        assert supersede_key(task("workflow", entity_id, step_id="x")) != supersede_key(
            task("workflow", entity_id, resource_id="x")
        )

    def test_scheduler_jobs_are_never_superseded(self):
        job = {"kind": TaskQueueKind.SCHEDULER_JOB, "entity": "scheduler_job", "payload": {"job_id": "1"}}
        assert supersede_key(job) is None


class TestCollapseBatch:
    def test_keeps_parallel_workflow_callbacks(self):
        entity_id = uuid4()
        items = [task("workflow", entity_id, resource_id="r1"), task("workflow", entity_id, resource_id="r2")]

        assert collapse_batch(items) == items

    def test_keeps_last_task_per_key_in_order(self):
        e1, e2 = uuid4(), uuid4()
        job = {"kind": TaskQueueKind.SCHEDULER_JOB, "entity": "scheduler_job", "payload": {}}
        items = [task(entity_id=e1, action="execute"), job, task(entity_id=e2), task(entity_id=e1, action="dryrun")]

        result = collapse_batch(items)

        assert result == [items[1], items[2], items[3]]


class TestNotifySuperseded:
    def superseded(self, created_by, replaced_by_user):
        return SupersededTask(
            id=uuid4(),
            action="execute",
            created_by=created_by,
            entity="resource",
            entity_id=uuid4(),
            replaced_by_action="dryrun",
            replaced_by_user=replaced_by_user,
        )

    async def test_notifies_requester_once_when_same_user(self, monkeypatch):
        send = AsyncMock()
        monkeypatch.setattr(notifications_mod, "deliver_in_app_notification", send)
        user = uuid4()

        await notify_superseded(self.superseded(created_by=user, replaced_by_user=user))

        send.assert_awaited_once()
        body = send.await_args_list[0].args[0]
        assert body["user_id"] == str(user)
        assert body["entity_type"] == "resource"
        assert body["status"] == "warning"
        assert body["title"] == "Resource action replaced"
        assert "execute" not in body["msg"] and "apply" in body["msg"] and "plan" in body["msg"]

    async def test_notifies_both_users_when_different(self, monkeypatch):
        send = AsyncMock()
        monkeypatch.setattr(notifications_mod, "deliver_in_app_notification", send)
        old_user, new_user = uuid4(), uuid4()

        await notify_superseded(self.superseded(created_by=old_user, replaced_by_user=new_user))

        user_ids = [call.args[0]["user_id"] for call in send.await_args_list]
        assert user_ids == [str(new_user), str(old_user)]


class TestToRow:
    def test_delay_holds_task_back(self):
        row = to_row({**task(), "delay_seconds": 20})
        # Compiled against the database clock rather than the app clock
        assert "now()" in str(row.available_at)

    def test_no_delay_uses_column_default(self):
        assert to_row({**task(), "delay_seconds": 0}).available_at is None
        assert to_row(task()).available_at is None


def test_drift_check_has_its_own_supersede_key():
    entity_id = uuid4()
    plan = task(entity_id=entity_id, action="dryrun")
    drift = task(entity_id=entity_id, action="check_drift")
    assert supersede_key(plan) != supersede_key(drift)
    assert collapse_batch([plan, drift]) == [plan, drift]
    assert collapse_batch([drift, dict(drift)]) == [drift]


def test_scheduled_drift_check_keeps_priority_in_queue_row():
    assert to_row({**task(action="check_drift"), "priority": -1}).priority == -1
