from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from sqlalchemy.dialects import postgresql

import core.task_queue.routing as core_routing
from application.worker_templates.crud import WorkerTemplateCRUD
from application.worker_templates.routing import (
    correlated_target_sql,
    resolve_worker_templates,
    target_template_sql,
)


def compile_sql(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def test_worker_templates_resolve_task_pools():
    assert core_routing._resolver is resolve_worker_templates


class TestTargetSql:
    def test_resource_uses_its_selection_then_the_default(self):
        resource_id = uuid4()

        sql = compile_sql(target_template_sql("resource", resource_id))

        assert sql.startswith("coalesce(")
        assert "SELECT resources.worker_template_id" in sql
        assert str(resource_id).replace("-", "") in sql.replace("-", "")
        assert "worker_templates.is_default IS true" in sql
        # a disabled selection is kept: its tasks wait instead of running on other workers
        assert "status" not in sql

    def test_executor_uses_executors_table(self):
        sql = compile_sql(target_template_sql("executor", uuid4()))

        assert "SELECT executors.worker_template_id" in sql

    def test_other_entities_use_the_default(self):
        sql = compile_sql(target_template_sql("source_code", uuid4()))

        assert not sql.startswith("coalesce(")
        assert "is_default" in sql
        assert "resources" not in sql

    def test_task_without_entity_uses_the_default(self):
        sql = compile_sql(target_template_sql("resource", None))

        assert "resources" not in sql

    def test_correlated_target_covers_routed_entities(self):
        sql = compile_sql(correlated_target_sql())

        assert "task_queue.entity = 'resource'" in sql
        assert "task_queue.entity = 'executor'" in sql
        assert "resources.id = task_queue.entity_id" in sql


class TestResolveWorkerTemplates:
    async def test_resolves_all_items_in_one_query_under_the_default_lock(self):
        template_id = uuid4()
        result = Mock()
        result.one.return_value = (template_id, None)
        session = Mock(execute=AsyncMock(return_value=result))

        pools = await resolve_worker_templates(
            session, [{"entity": "resource", "entity_id": uuid4()}, {"entity": "source_code", "entity_id": uuid4()}]
        )

        assert pools == [template_id, None]
        lock, query = (call.args[0] for call in session.execute.await_args_list)
        # shared with other enqueues, so only a default change waits
        assert "pg_advisory_xact_lock_shared" in compile_sql(lock)
        assert compile_sql(query).count("is_default") == 2


class TestRetargetQueuedTasks:
    async def test_updates_only_queued_tasks_whose_target_changed(self):
        result = Mock()
        result.scalars.return_value.all.return_value = []
        session = Mock(execute=AsyncMock(return_value=result), flush=AsyncMock())
        resource_id = uuid4()

        assert await WorkerTemplateCRUD(session).retarget_queued_tasks(entity="resource", entity_id=resource_id) == 0

        sql = compile_sql(session.execute.await_args.args[0])
        assert sql.startswith("UPDATE task_queue SET worker_template_id=coalesce(")
        assert "task_queue.status = 'queued'" in sql
        assert "running" not in sql
        assert "task_queue.worker_template_id IS DISTINCT FROM coalesce(" in sql
        assert "task_queue.entity = 'resource'" in sql

    async def test_changed_tasks_wake_workers_and_refresh_the_ui(self, monkeypatch):
        import application.worker_templates.crud as crud_mod

        task = Mock()
        result = Mock()
        result.scalars.return_value.all.return_value = [task]
        session = Mock(execute=AsyncMock(return_value=result), flush=AsyncMock())
        publish = AsyncMock()
        monkeypatch.setattr(crud_mod, "publish_tasks_changed", publish)

        assert await WorkerTemplateCRUD(session).retarget_queued_tasks() == 1

        publish.assert_awaited_once_with(session, [task])
