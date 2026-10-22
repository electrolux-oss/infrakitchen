from datetime import UTC, datetime, timedelta
from typing import Any, ClassVar
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.worker_templates.autoscaler import SpawnBackoff, reconcile, save_errors, worker_env
from application.worker_templates.model import WorkerTemplateDTO
from application.worker_templates.providers import WorkerInstance, WorkerInstancePhase, WorkerProvider
from core.constants import ModelStatus

NOW = datetime(2026, 1, 1, 12, tzinfo=UTC)
START_TIMEOUT = timedelta(minutes=10)
FAILED_RETENTION = timedelta(hours=1)


class FakeProvider(WorkerProvider):
    """In-memory provider: shows the autoscaler only needs the WorkerProvider interface."""

    provider: ClassVar[str] = "fake"

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


async def run(templates, providers, remove_rows, claimable=0, free=0, registered=(), backoff=None, now=NOW):
    return await reconcile(
        templates=templates,
        claimable_tasks=claimable,
        free_workers=free,
        registered_hosts=set(registered),
        remove_worker_rows=remove_rows,
        start_timeout=START_TIMEOUT,
        failed_retention=FAILED_RETENTION,
        provider_factory=lambda t: providers[t.id],
        backoff=backoff,
        now=now,
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

    async def test_overflows_to_next_template_by_order(self, mocked_worker_template, remove_rows):
        first = make_template(mocked_worker_template, max_workers=1)
        second = make_template(mocked_worker_template, max_workers=5)
        providers = {first.id: FakeProvider(first), second.id: FakeProvider(second)}

        result = await run([first, second], providers, remove_rows, claimable=3)

        assert result.spawned == {first.id: 1, second.id: 2}

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

    async def test_spawn_error_is_recorded_and_next_template_used(self, mocked_worker_template, remove_rows):
        broken = make_template(mocked_worker_template)
        fallback = make_template(mocked_worker_template)
        providers = {broken.id: FakeProvider(broken), fallback.id: FakeProvider(fallback)}
        providers[broken.id].fail_spawn = True

        result = await run([broken, fallback], providers, remove_rows, claimable=1)

        assert result.errors[broken.id] == "Cannot spawn a worker: quota exceeded"
        assert result.spawned == {fallback.id: 1}

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
        backoff = SpawnBackoff(seen_failed={"crashed"})
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

    async def test_backed_off_template_falls_through_to_next(self, mocked_worker_template, remove_rows):
        broken = make_template(mocked_worker_template)
        fallback = make_template(mocked_worker_template)
        providers = {broken.id: FakeProvider(broken), fallback.id: FakeProvider(fallback)}
        backoff = SpawnBackoff()
        backoff.failure(broken.id, NOW)

        result = await run([broken, fallback], providers, remove_rows, claimable=2, backoff=backoff)

        assert result.spawned == {fallback.id: 2}

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

    async def test_changed_configuration_resets_backoff(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template)
        provider = FakeProvider(template)
        backoff = SpawnBackoff()
        await run([template], {template.id: provider}, remove_rows, backoff=backoff)
        backoff.failure(template.id, NOW)

        reenabled = template.model_copy(update={"status": ModelStatus.DISABLED})
        await run([reenabled], {template.id: provider}, remove_rows, backoff=backoff)

        assert template.id not in backoff.failures


class TestSaveErrors:
    async def test_only_changed_errors_of_known_templates_are_written(self, mocked_worker_template):
        same = make_template(mocked_worker_template, last_error="boom")
        changed = make_template(mocked_worker_template, last_error=None)
        session = AsyncMock()

        await save_errors(session, [same, changed], {same.id: "boom", changed.id: "new", uuid4(): "gone"})

        assert session.execute.await_count == 1


class TestReconcileWorkers:
    async def test_no_templates_does_nothing(self, monkeypatch):
        from contextlib import asynccontextmanager

        import application.worker_templates.autoscaler as autoscaler

        session = AsyncMock()
        session.execute = AsyncMock(return_value=Mock(scalar_one=Mock(return_value=True)))

        @asynccontextmanager
        async def get_session():
            yield session

        crud = Mock(get_all=AsyncMock(return_value=[]))
        provider_factory = Mock()
        monkeypatch.setattr(autoscaler, "get_async_session", get_session)
        monkeypatch.setattr(autoscaler, "WorkerTemplateCRUD", Mock(return_value=crud))
        monkeypatch.setattr(autoscaler, "get_worker_provider", provider_factory)

        assert await autoscaler.reconcile_workers() is None
        crud.get_all.assert_awaited_once()
        provider_factory.assert_not_called()
