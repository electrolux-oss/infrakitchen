from datetime import UTC, datetime, timedelta
from typing import Any, ClassVar
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from application.worker_templates.autoscaler import reconcile, worker_env
from application.worker_templates.model import WorkerTemplateDTO
from application.worker_templates.providers import WorkerInstance, WorkerInstancePhase, WorkerProvider
from core.constants import ModelStatus

NOW = datetime(2026, 1, 1, 12, tzinfo=UTC)
START_TIMEOUT = timedelta(minutes=10)


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


def instance(name: str, phase: WorkerInstancePhase, age: timedelta = timedelta(minutes=1)) -> WorkerInstance:
    return WorkerInstance(id=name, host=name, phase=phase, created_at=NOW - age)


@pytest.fixture
def remove_rows():
    return AsyncMock()


async def run(templates, providers, remove_rows, claimable=0, free=0, registered=()):
    return await reconcile(
        templates=templates,
        claimable_tasks=claimable,
        free_workers=free,
        registered_hosts=set(registered),
        remove_worker_rows=remove_rows,
        start_timeout=START_TIMEOUT,
        provider_factory=lambda t: providers[t.id],
        now=NOW,
    )


class TestScaleUp:
    async def test_spawns_for_waiting_tasks(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, max_workers=5, idle_timeout_seconds=120)
        provider = FakeProvider(template)

        result = await run([template], {template.id: provider}, remove_rows, claimable=3, free=1)

        assert result.spawned == {template.id: 2}
        assert provider.spawned_env[0] == worker_env(template)
        assert provider.spawned_env[0]["WORKER_IDLE_EXIT_SECONDS"] == "120"
        assert result.errors == {template.id: None}

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
                instance("crashed", "failed"),
                instance("stuck", "pending", age=timedelta(minutes=11)),
                instance("starting", "pending"),
                instance("working", "running"),
            ],
        )

        result = await run([template], {template.id: provider}, remove_rows, registered=["working"])

        assert provider.deleted == ["done", "crashed", "stuck"]
        assert result.removed == {template.id: ["done", "crashed", "stuck"]}
        assert [c.args[0] for c in remove_rows.await_args_list] == ["done", "crashed", "stuck"]

    async def test_disabled_template_is_cleaned_up(self, mocked_worker_template, remove_rows):
        template = make_template(mocked_worker_template, status=ModelStatus.DISABLED)
        provider = FakeProvider(template, [instance("done", "succeeded")])

        _ = await run([template], {template.id: provider}, remove_rows)

        assert provider.deleted == ["done"]


class TestReconcileWorkers:
    async def test_disabled_by_setting(self, monkeypatch):
        import application.worker_templates.autoscaler as autoscaler

        session_factory = AsyncMock()
        monkeypatch.setattr(autoscaler, "get_async_session", session_factory)

        assert await autoscaler.reconcile_workers() is None
        session_factory.assert_not_called()
