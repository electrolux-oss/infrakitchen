from typing import Any
from uuid import UUID

from sqlalchemy import func, literal, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_models import Base
from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid

from .model import Tool
from .query_options import build_tool_query_options


class ToolCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, tool_id: str | UUID, fields: FieldSpec | None = None) -> Tool | None:
        if not is_valid_uuid(tool_id):
            raise ValueError(f"Invalid UUID: {tool_id}")

        statement = select(Tool).where(Tool.id == tool_id)
        statement = statement.options(*build_tool_query_options(fields))
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_one(self, name: str, version: str, os: str, arch: str) -> Tool | None:
        statement = select(Tool).where(
            Tool.name == name,
            Tool.version == version,
            Tool.os == os,
            Tool.arch == arch,
        )
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_default(self) -> Tool | None:
        result = await self.session.execute(select(Tool).where(Tool.is_default.is_(True)))
        return result.unique().scalars().first()

    async def set_default(self, tool: Tool | None) -> None:
        """Make `tool` the only default one, None clears the default."""
        await self.session.execute(update(Tool).where(Tool.is_default.is_(True)).values(is_default=False))
        if tool is not None:
            tool.is_default = True
        await self.session.flush()
        if tool is not None:
            # server-side onupdate expires updated_at, reload it so it can be read outside the greenlet
            await self.session.refresh(tool)

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Tool]:
        statement = select(Tool)
        statement = evaluate_sqlalchemy_filters(Tool, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Tool, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        statement = statement.options(*build_tool_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Tool)
        statement = evaluate_sqlalchemy_filters(Tool, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def get_content(self, tool_id: str | UUID) -> bytes | None:
        result = await self.session.execute(select(Tool.content).where(Tool.id == tool_id))
        return result.scalar_one_or_none()

    async def create(self, body: dict[str, Any]) -> Tool:
        db_tool = Tool(**body)
        self.session.add(db_tool)
        await self.session.flush()
        return db_tool

    async def update(self, existing_tool: Tool, body: dict[str, Any]) -> Tool:
        for key, value in body.items():
            setattr(existing_tool, key, value)
        await self.session.flush()
        return existing_tool

    async def delete(self, tool: Tool) -> None:
        await self.session.delete(tool)
        await self.session.flush()

    async def refresh(self, tool: Tool) -> None:
        await self.session.refresh(tool)

    async def get_dependencies(self, existing_tool: Tool) -> list[Any]:
        """
        Find rows referencing the tool. Referencing tables are discovered from foreign keys,
        so entities using tools don't have to be known here.
        """
        dependencies: list[Any] = []
        for table in Base.metadata.sorted_tables:
            for column in table.columns:
                if not any(fk.column.table.name == Tool.__tablename__ for fk in column.foreign_keys):
                    continue
                name_column = table.c["name"] if "name" in table.c else literal("")
                entity_name = str(table.name).removesuffix("s")
                statement = select(
                    table.c["id"].label("id"),
                    literal(entity_name).label("type"),
                    name_column.label("name"),
                ).where(column == existing_tool.id)
                result = await self.session.execute(statement)
                dependencies.extend(result.fetchall())

        # pending (not yet approved) resource changes keep the tool_id in a JSON blob without a foreign key
        temp_state = Base.metadata.tables.get("resources_temp_state")
        resources = Base.metadata.tables.get("resources")
        if temp_state is not None and resources is not None:
            statement = (
                select(
                    resources.c["id"].label("id"),
                    literal("resource").label("type"),
                    resources.c["name"].label("name"),
                )
                .join(temp_state, temp_state.c["resource_id"] == resources.c["id"])
                .where(temp_state.c["value"]["tool_id"].as_string() == str(existing_tool.id))
            )
            result = await self.session.execute(statement)
            known = {dependency.id for dependency in dependencies}
            dependencies.extend(row for row in result.fetchall() if row.id not in known)
        return dependencies
