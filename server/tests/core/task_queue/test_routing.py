from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

import core.task_queue.routing as routing
from core.task_queue.routing import register_pool_resolver, resolve_targets


@pytest.fixture
def restore_resolver(monkeypatch):
    monkeypatch.setattr(routing, "_resolver", routing._resolver)


class TestResolveTargets:
    async def test_sets_the_pool_of_each_item(self, restore_resolver):
        pools = [uuid4(), None]
        resolver = AsyncMock(return_value=pools)
        register_pool_resolver(resolver)
        session = Mock()
        items = [{"entity": "resource", "entity_id": uuid4()}, {"entity": "scheduler_job", "entity_id": None}]

        await resolve_targets(session, items)

        assert [item["worker_template_id"] for item in items] == pools
        # resolved once per batch
        resolver.assert_awaited_once_with(session, items)

    async def test_nothing_to_resolve(self, restore_resolver):
        resolver = AsyncMock()
        register_pool_resolver(resolver)

        await resolve_targets(Mock(), [])

        resolver.assert_not_awaited()

    async def test_without_a_resolver_every_task_runs_on_static_workers(self, monkeypatch):
        monkeypatch.setattr(routing, "_resolver", routing._static_pools)
        session = Mock(execute=AsyncMock())
        items = [{"entity": "resource", "entity_id": uuid4()}]

        await resolve_targets(session, items)

        assert items[0]["worker_template_id"] is None
        session.execute.assert_not_awaited()
