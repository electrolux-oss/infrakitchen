from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from core.task_queue.model import TaskQueueItem
from core.task_queue.query_options import build_task_queue_query_options


def compiled_select(fields) -> str:
    statement = select(TaskQueueItem).options(*build_task_queue_query_options(fields))
    return str(statement.compile(dialect=postgresql.dialect()))


class TestTaskQueueQueryOptions:
    def test_no_fields_loads_everything(self):
        assert build_task_queue_query_options(None) == []

    def test_computed_fields_load_their_backing_columns(self):
        sql = compiled_select({"id": None, "workerHost": None, "creator": None, "entityData": None})

        for column in ("worker_id", "created_by", "entity", "entity_id"):
            assert f"task_queue.{column}" in sql
        assert "task_queue.payload" not in sql
