from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from application.integrations.model import Integration
from application.resources.model import Resource
from application.secrets.model import Secret
from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid

from .model import Workflow, WorkflowStep
from .query_options import build_workflow_query_options


def _workflow_load_options() -> list[Any]:
    """Eager-load options for Workflow queries."""
    step_load = selectinload(Workflow.steps)
    return [
        step_load.selectinload(WorkflowStep.integration_ids),
        step_load.selectinload(WorkflowStep.secret_ids),
        step_load.joinedload(WorkflowStep.template),
        step_load.joinedload(WorkflowStep.resource),
        step_load.joinedload(WorkflowStep.source_code_version),
        step_load.selectinload(WorkflowStep.parent_resource_ids),
    ]


class WorkflowCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        workflow_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> Workflow | None:
        if not is_valid_uuid(workflow_id):
            raise ValueError(f"Invalid UUID: {workflow_id}")

        statement = select(Workflow).where(Workflow.id == workflow_id).options(*build_workflow_query_options(fields))
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Workflow]:
        statement = select(Workflow).options(*build_workflow_query_options(fields))

        statement = evaluate_sqlalchemy_sorting(Workflow, statement, sort)

        statement = evaluate_sqlalchemy_filters(Workflow, statement, filter)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Workflow)
        statement = evaluate_sqlalchemy_filters(Workflow, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def _resolve_integrations(self, ids: list[UUID]) -> list[Integration]:
        if not ids:
            return []
        result = await self.session.execute(select(Integration).where(Integration.id.in_(ids)))
        return list(result.scalars().all())

    async def _resolve_secrets(self, ids: list[UUID]) -> list[Secret]:
        if not ids:
            return []
        result = await self.session.execute(select(Secret).where(Secret.id.in_(ids)))
        return list(result.scalars().all())

    async def _resolve_parent_resources(self, ids: list[UUID]) -> list[Resource]:
        if not ids:
            return []
        result = await self.session.execute(select(Resource).where(Resource.id.in_(ids)))
        return list(result.scalars().all())

    async def create(self, data: dict[str, Any]) -> Workflow:
        steps_data = data.pop("steps", [])

        workflow = Workflow(**data)
        self.session.add(workflow)
        await self.session.flush()

        for step_data in steps_data:
            step_integration_ids = step_data.pop("integration_ids", [])
            step_secret_ids = step_data.pop("secret_ids", [])
            step_parent_resource_ids = step_data.pop("parent_resource_ids", [])
            step = WorkflowStep(workflow_id=workflow.id, **step_data)
            step.integration_ids = await self._resolve_integrations(step_integration_ids)
            step.secret_ids = await self._resolve_secrets(step_secret_ids)
            step.parent_resource_ids = await self._resolve_parent_resources(step_parent_resource_ids)
            self.session.add(step)
        await self.session.flush()

        result = await self.get_by_id(workflow.id)
        if result is None:
            raise ValueError("Failed to retrieve workflow after creation")
        return result

    async def update_step(self, step_id: UUID, data: dict[str, Any]) -> WorkflowStep | None:
        statement = select(WorkflowStep).where(WorkflowStep.id == step_id)
        result = await self.session.execute(statement)
        step = result.scalar_one_or_none()
        if step is None:
            return None

        if "integration_ids" in data:
            step.integration_ids = await self._resolve_integrations(data.pop("integration_ids"))
        if "secret_ids" in data:
            step.secret_ids = await self._resolve_secrets(data.pop("secret_ids"))
        if "parent_resource_ids" in data:
            step.parent_resource_ids = await self._resolve_parent_resources(data.pop("parent_resource_ids"))

        for key, value in data.items():
            if hasattr(step, key):
                setattr(step, key, value)
        await self.session.flush()
        return step

    async def delete(self, workflow_id: UUID | str) -> None:
        workflow = await self.get_by_id(workflow_id)
        if workflow:
            await self.session.delete(workflow)
            await self.session.flush()
