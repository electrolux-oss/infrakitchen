from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from sqlalchemy.dialects import postgresql

from core.task_queue.crud import TaskQueueCRUD


def compile_sql(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def result(rows):
    return Mock(all=Mock(return_value=rows))


class TestInPool:
    def test_static_workers_take_only_static_tasks(self):
        sql = compile_sql(TaskQueueCRUD._in_pool(None))

        assert sql == "task_queue.worker_template_id IS NOT DISTINCT FROM NULL"

    def test_template_workers_take_only_their_template_tasks(self):
        template_id = uuid4()

        sql = compile_sql(TaskQueueCRUD._in_pool(template_id))

        assert sql == f"task_queue.worker_template_id IS NOT DISTINCT FROM '{template_id}'"
        # core knows nothing about worker templates
        assert "worker_templates" not in sql


class TestCountClaimable:
    async def test_counts_only_the_pool_of_the_worker(self):
        template_id = uuid4()
        session = Mock(
            execute=AsyncMock(
                side_effect=[
                    # claimable: (pool, per entity, without entity)
                    result([(template_id, 1, 1)]),
                    # expired leases
                    result([(template_id, 1)]),
                ]
            )
        )

        assert await TaskQueueCRUD(session).count_claimable(template_id) == 3

        sql = compile_sql(session.execute.await_args_list[0].args[0])
        assert f"task_queue.worker_template_id IS NOT DISTINCT FROM '{template_id}'" in sql


class TestWorkerCountsByTemplate:
    async def test_groups_by_pool_and_counts_stale_workers_offline(self):
        template_id = uuid4()
        session = Mock(
            execute=AsyncMock(
                return_value=result(
                    [(None, "free", 2), (None, "offline", 1), (str(template_id), "busy", 3), ("not-a-uuid", "free", 1)]
                )
            )
        )

        counts = await TaskQueueCRUD(session).worker_counts_by_template(datetime.now(UTC))

        # a worker with an invalid template id in its metadata belongs to the static pool
        assert counts == {
            None: {"free": 3, "busy": 0, "offline": 1},
            template_id: {"free": 0, "busy": 3, "offline": 0},
        }
        sql = compile_sql(session.execute.await_args.args[0])
        assert "CASE WHEN (workers.updated_at >= " in sql
        assert "workers.status != 'offline'" in sql
        assert "ELSE 'offline' END" in sql
