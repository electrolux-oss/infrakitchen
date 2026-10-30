from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.worker_templates.autoscaler import SpawnBackoff, reconcile, save_errors, worker_env
from application.worker_templates.model import WorkerTemplateDTO
from core.adapters.provider_adapters import WorkerInstance, WorkerInstancePhase, WorkerProviderAdapter
from core.constants import ModelStatus

NOW = datetime(2026, 1, 1, 12, tzinfo=UTC)
START_TIMEOUT = timedelta(minutes=10)
FAILED_RETENTION = timedelta(hours=1)


class FakeProvider(WorkerProviderAdapter):
    """In-memory provider: shows the autoscaler only needs the WorkerProviderAdapter interface."""

    __worker_provider_adapter_name__: str = "fake"

    def __init__(self, template: WorkerTemplateDTO, instances: list[WorkerInstance] | None = None):
        super().__init__(template)
        self.instances: list[WorkerInstance] = instances or []
        self.spawned_env: list[dict[str, str]] = []
        self.deleted: list[str] = []
        self.fail_spawn: bool = False
        self.fail_list: bool = False

    async def spawn(self, env: dict[str, str]) -> WorkerInstance:
        if self.fail_spawn:
            raise RuntimeError("quota exceeded")
        self.spawned_env.append(env)
        instance = WorkerInstance(id=f"w{len(self.spawned_env)}", host=f"w{len(self.spawned_env)}", phase="pending")
        self.instances.append(instance)
        return instance

    async def list_instances(self) -> list[WorkerInstance]:
        if self.fail_list:
            raise RuntimeError("forbidden")
        return list(self.instances)

    async def delete_instance(self, instance: WorkerInstance) -> None:
        self.deleted.append(instance.id)

    @classmethod
    def default_configuration(cls) -> dict[str, Any]:
        return {}


# Subclasses register themselves; keep the test double out of the real provider list
del WorkerProviderAdapter.adapters[FakeProvider.__worker_provider_adapter_name__]


def make_template(mocked_worker_template, **kwargs) -> WorkerTemplateDTO:
    template = WorkerTemplateDTO.model_validate(mocked_worker_template)
    return template.model_copy(update={"id": uuid4(), **kwargs})


def instance(
    name: str, phase: WorkerInstancePhase, age: timedelta = timedelta(minutes=1), reason: str | None = None
) -> WorkerInstance:
    return WorkerInstance(id=name, host=name, phase=phase, created_at=NOW - age, reason=reason)


@pytest.fixture
def remove_rows():
    return AsyncMock()


def per_template(templates, value: int | dict[Any, int]) -> dict[Any, int]:
    """An int applies to the first template, the only one in most tests."""
    if isinstance(value, dict):
        return value
    return {templates[0].id: value} if templates else {}


async def run(
    templates,
    providers,
    remove_rows,
    claimable: int | dict[Any, int] = 0,
    free: int | dict[Any, int] = 0,
    registered=(),
    known=None,
    backoff=None,
    now=NOW,
    remove_gone=None,
):
    return await reconcile(
        templates=templates,
        claimable_by_template=per_template(templates, claimable),
        free_by_template=per_template(templates, free),
        registered_hosts=set(registered),
        known_hosts=set(known) if known is not None else None,
        remove_worker_rows=remove_rows,
        start_timeout=START_TIMEOUT,
        failed_retention=FAILED_RETENTION,
        provider_factory=lambda t: providers[t.id],
        backoff=backoff,
        now=now,
        remove_gone_worker_rows=remove_gone,
    )


class TestScaleUp:
    async def test_spawns_for_waiting_tasks(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, max_workers=5, idle_timeout_seconds=120)
        provider = FakeProvider(template)

        result = await run([template], {template.id: provider}, remove_rows, claimable=3, free=1)

        assert result.spawned == {template.id: 2}
        assert provider.spawned_env[0] == worker_env(template)
        assert provider.spawned_env[0]["WORKER_IDLE_EXIT_SECONDS"] == "120"
        assert provider.spawned_env[0]["WORKER_NAME"] == template.name
        assert result.errors == {}

    async def test_respects_max_workers(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, max_workers=2)
        provider = FakeProvider(template, [instance("busy", "running")])

        result = await run([template], {template.id: provider}, remove_rows, claimable=10, registered=["busy"])

        assert result.spawned == {template.id: 1}

    async def test_each_template_scales_for_its_own_tasks(self, mocked_worker_template, remove_rows):
        first = make_template(mocked_worker_template, max_workers=1)
        second = make_template(mocked_worker_template, max_workers=5)
        idle = make_template(mocked_worker_template, max_workers=5)
        providers = {t.id: FakeProvider(t) for t in (first, second, idle)}

        result = await run(
            [first, second, idle],
            providers,
            remove_rows,
            # a full template does not spill its tasks to another one, and static workers' tasks spawn nothing
            claimable={first.id: 3, second.id: 2, None: 4},
            free={second.id: 1, None: 0},
        )

        assert result.spawned == {first.id: 1, second.id: 1}

    async def test_starting_instances_count_as_capacity(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, max_workers=5)
        provider = FakeProvider(template, [instance("a", "pending"), instance("b", "running")])

        result = await run([template], {template.id: provider}, remove_rows, claimable=2)

        assert result.spawned == {}

    async def test_no_spawn_when_free_workers_cover_queue(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template)

        result = await run([template], {template.id: provider}, remove_rows, claimable=2, free=2)

        assert result.spawned == {}

    async def test_disabled_template_does_not_spawn(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, status=ModelStatus.DISABLED)
        provider = FakeProvider(template)

        result = await run([template], {template.id: provider}, remove_rows, claimable=2)

        assert result.spawned == {}

    async def test_spawn_error_is_recorded_and_other_templates_still_spawn(self, mocked_worker_template, remove_rows):
        broken = make_template(mocked_worker_template)
        other = make_template(mocked_worker_template)
        providers = {broken.id: FakeProvider(broken), other.id: FakeProvider(other)}
        providers[broken.id].fail_spawn = True

        result = await run([broken, other], providers, remove_rows, claimable={broken.id: 1, other.id: 1})

        assert result.errors[broken.id] == "Cannot spawn a worker: quota exceeded"
        assert result.spawned == {other.id: 1}

    async def test_list_error_skips_template(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template)
        provider.fail_list = True

        result = await run([template], {template.id: provider}, remove_rows, claimable=1)

        assert result.spawned == {}
        assert result.errors[template.id] == "Cannot list workers: forbidden"


class TestCleanup:
    async def test_removes_finished_and_stuck_instances(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(
            template,
            [
                instance("done", "succeeded"),
                instance("old-crash", "failed", age=timedelta(hours=2)),
                instance("crashed", "failed"),
                instance("stuck", "pending", age=timedelta(minutes=11)),
                instance("starting", "pending"),
                instance("working", "running"),
            ],
        )

        result = await run([template], {template.id: provider}, remove_rows, registered=["working"])

        # A recently failed instance is kept for its logs
        assert provider.deleted == ["done", "old-crash", "stuck"]
        assert result.removed == {template.id: ["done", "old-crash", "stuck"]}
        assert [c.args[0] for c in remove_rows.await_args_list] == ["done", "old-crash", "stuck"]

    async def test_failed_instances_do_not_count_against_max_workers(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, max_workers=1)
        backoff = SpawnBackoff(failed_at={template.id: NOW})
        provider = FakeProvider(template, [instance("crashed", "failed")])

        result = await run([template], {template.id: provider}, remove_rows, claimable=1, backoff=backoff)

        assert result.spawned == {template.id: 1}

    async def test_disabled_template_is_cleaned_up(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, status=ModelStatus.DISABLED)
        provider = FakeProvider(template, [instance("done", "succeeded")])

        _ = await run([template], {template.id: provider}, remove_rows)

        assert provider.deleted == ["done"]


class TestFailures:
    async def test_failed_instance_sets_error_once_and_backs_off(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template, [instance("crashed", "failed", reason="OOMKilled (exit code 137)")])
        backoff = SpawnBackoff()

        result = await run([template], {template.id: provider}, remove_rows, claimable=1, backoff=backoff)

        assert result.errors == {template.id: "Worker crashed failed: OOMKilled (exit code 137)"}
        assert result.spawned == {}
        assert backoff.blocked_until(template.id, NOW) == NOW + timedelta(seconds=30)

        # Seen already: not reported again, and spawning resumes after the back-off
        later = NOW + timedelta(seconds=31)
        result = await run([template], {template.id: provider}, remove_rows, claimable=1, backoff=backoff, now=later)

        assert template.id not in result.errors
        assert result.spawned == {template.id: 1}

    async def test_backoff_doubles_and_is_capped(self):
        backoff = SpawnBackoff()
        template_id = uuid4()
        delays = []
        for _ in range(7):
            backoff.failure(template_id, NOW)
            delays.append((backoff.until[template_id] - NOW).total_seconds())

        assert delays == [30, 60, 120, 240, 480, 600, 600]

    async def test_spawn_error_backs_off(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template)
        provider.fail_spawn = True
        backoff = SpawnBackoff()

        _ = await run([template], {template.id: provider}, remove_rows, claimable=1, backoff=backoff)
        provider.fail_spawn = False
        result = await run([template], {template.id: provider}, remove_rows, claimable=1, backoff=backoff)

        assert result.spawned == {}

    async def test_registered_worker_clears_error_and_backoff(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, last_error="Worker x failed: boom")
        provider = FakeProvider(template, [instance("working", "running")])
        backoff = SpawnBackoff()
        backoff.failure(template.id, NOW)

        result = await run([template], {template.id: provider}, remove_rows, registered=["working"], backoff=backoff)

        assert result.errors == {template.id: None}
        assert backoff.blocked_until(template.id, NOW) is None

    async def test_stuck_instance_reports_reason(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template, [instance("stuck", "pending", age=timedelta(minutes=11))])

        result = await run([template], {template.id: provider}, remove_rows)

        assert result.errors == {template.id: "Worker stuck failed: not started within 600s"}

    async def test_list_error_cleared_after_successful_list(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, last_error="Cannot list workers: forbidden")
        provider = FakeProvider(template)

        result = await run([template], {template.id: provider}, remove_rows)

        assert result.errors == {template.id: None}


class TestRobustness:
    async def test_running_instance_that_never_registers_is_removed(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template, [instance("wedged", "running", age=timedelta(minutes=11))])

        result = await run([template], {template.id: provider}, remove_rows)

        assert provider.deleted == ["wedged"]
        assert result.removed == {template.id: ["wedged"]}

    async def test_registered_worker_with_missed_heartbeats_is_not_removed(self, mocked_worker_template, remove_rows):
        # e.g. a long apply while the database was unreachable, or a worker going offline before it exits
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template, [instance("working", "running", age=timedelta(hours=2))])
        backoff = SpawnBackoff()

        result = await run(
            [template], {template.id: provider}, remove_rows, registered=[], known=["working"], backoff=backoff
        )

        assert provider.deleted == []
        assert result.errors == {}
        assert template.id not in backoff.failures

    async def test_failure_is_counted_once_when_removal_keeps_failing(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template, [instance("stuck", "pending", age=timedelta(minutes=11))])
        remove_rows.side_effect = RuntimeError("db down")
        backoff = SpawnBackoff()

        await run([template], {template.id: provider}, remove_rows, backoff=backoff)
        await run([template], {template.id: provider}, remove_rows, backoff=backoff)

        assert backoff.failures[template.id] == 1

    async def test_rows_are_removed_before_the_instance(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template, [instance("done", "succeeded")])
        remove_rows.side_effect = RuntimeError("db down")

        await run([template], {template.id: provider}, remove_rows)

        assert provider.deleted == []

    async def test_retained_failed_instance_is_not_counted_again_after_a_reset(
        self, mocked_worker_template, remove_rows
    ):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template, [instance("crashed", "failed"), instance("working", "running")])
        backoff = SpawnBackoff()
        backoff.failure(template.id, NOW)  # the crash was counted by an earlier pass
        _ = await run([template], {template.id: provider}, remove_rows, registered=["working"], backoff=backoff)
        # the healthy worker cleared the backoff; the failed instance is still there
        assert template.id not in backoff.failures

        _ = await run([template], {template.id: provider}, remove_rows, registered=["working"], backoff=backoff)

        assert template.id not in backoff.failures


class TestBackoffPersistence:
    def test_loaded_from_the_template(self, mocked_worker_template):
        template = make_template(
            mocked_worker_template,
            spawn_failures=3,
            spawn_blocked_until=NOW + timedelta(minutes=2),
            spawn_failed_at=NOW,
        )

        backoff = SpawnBackoff.load([template])

        assert backoff.failures == {template.id: 3}
        assert backoff.blocked_until(template.id, NOW) == NOW + timedelta(minutes=2)
        assert not backoff.is_new_failure(template.id, NOW - timedelta(seconds=1))
        assert backoff.is_new_failure(template.id, NOW + timedelta(seconds=1))
        assert backoff.touched == set()

    async def test_a_failure_by_one_process_blocks_the_next_one(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        first = SpawnBackoff.load([template])
        provider = FakeProvider(template, [instance("crashed", "failed")])
        _ = await run([template], {template.id: provider}, remove_rows, claimable=1, backoff=first)

        # another scheduler process reads the saved state
        saved = template.model_copy(
            update={
                "spawn_failures": first.failures[template.id],
                "spawn_blocked_until": first.until[template.id],
                "spawn_failed_at": first.failed_at[template.id],
            }
        )
        second = SpawnBackoff.load([saved])
        result = await run([saved], {template.id: provider}, remove_rows, claimable=1, backoff=second)

        assert result.spawned == {}
        assert second.failures[template.id] == 1  # the failed instance was not counted twice

    async def test_only_touched_backoffs_are_saved(self, monkeypatch, mocked_worker_template):
        touched = make_template(mocked_worker_template)
        untouched = make_template(mocked_worker_template)
        backoff = SpawnBackoff()
        backoff.failure(touched.id, NOW)
        service = Mock(set_last_error=AsyncMock(), set_spawn_backoff=AsyncMock())

        await save_errors(service, [touched, untouched], {}, backoff)

        service.set_spawn_backoff.assert_awaited_once_with(touched.id, 1, NOW + timedelta(seconds=30), NOW)


class TestGoneWorkers:
    async def test_rows_of_workers_whose_instance_is_gone_are_removed(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, max_workers=5)
        provider = FakeProvider(template, [instance("a", "running")])
        remove_gone = AsyncMock()

        _ = await run([template], {template.id: provider}, remove_rows, registered=["a"], remove_gone=remove_gone)

        # every other host of the template, e.g. a pod deleted by hand, has no instance to be removed with
        remove_gone.assert_awaited_once_with(template, {"a"})

    async def test_failing_cleanup_does_not_stop_scaling(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, max_workers=5)
        provider = FakeProvider(template)

        result = await run(
            [template],
            {template.id: provider},
            remove_rows,
            claimable=1,
            remove_gone=AsyncMock(side_effect=RuntimeError("db down")),
        )

        assert result.spawned == {template.id: 1}
