import importlib
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from sqlalchemy.dialects import postgresql

from core.database import find_referencing_rows

importlib.import_module("application")  # registers every model, so foreign keys can be discovered


def compile_sql(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def make_session(rows_per_query: dict[str, list[SimpleNamespace]]) -> Mock:
    """Answers each query with the rows of the first table it selects from."""

    async def execute(statement):
        sql = compile_sql(statement)
        for table, rows in rows_per_query.items():
            if f"FROM {table}" in sql:
                return Mock(fetchall=Mock(return_value=rows))
        return Mock(fetchall=Mock(return_value=[]))

    return Mock(execute=AsyncMock(side_effect=execute))


def queried_tables(session: Mock) -> list[str]:
    return [compile_sql(call.args[0]).split("FROM ")[1].split()[0] for call in session.execute.await_args_list]


class TestFindReferencingRows:
    async def test_finds_tables_by_foreign_key(self):
        template_id = uuid4()
        session = make_session({})

        _ = await find_referencing_rows(session, "worker_templates", template_id, "worker_template_id")

        tables = queried_tables(session)
        assert "resources" in tables
        assert "executors" in tables
        assert "task_queue" in tables

    async def test_skips_tables(self):
        session = make_session({})

        _ = await find_referencing_rows(
            session, "worker_templates", uuid4(), "worker_template_id", skip_tables=("task_queue",)
        )

        assert "task_queue" not in queried_tables(session)

    async def test_pending_resource_changes_are_searched_once(self):
        resource_id = uuid4()
        row = SimpleNamespace(id=resource_id, type="resource", name="r1")
        session = make_session({"resources JOIN resources_temp_state": [row], "resources": [row]})

        result = await find_referencing_rows(session, "tools", uuid4(), "tool_id")

        # found both by the foreign key and in the pending changes, listed once
        assert result == [row]
        last_sql = compile_sql(session.execute.await_args_list[-1].args[0])
        assert "resources_temp_state.value ->> 'tool_id'" in last_sql
