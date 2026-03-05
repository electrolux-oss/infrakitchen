from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from application.integrations.model import Integration
from application.secrets.model import Secret
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.users.model import User
from core.utils.model_tools import is_valid_uuid

from .model import Workflow, WorkflowStep


def _workflow_load_options() -> list:
    """Eager-load options for Workflow queries."""
    step_load = selectinload(Workflow.steps)
    return [
        selectinload(Workflow.integration_ids),
        selectinload(Workflow.secret_ids),
        step_load.selectinload(WorkflowStep.integration_ids),
        step_load.selectinload(WorkflowStep.secret_ids),
        step_load.joinedload(WorkflowStep.template),
        step_load.joinedload(WorkflowStep.resource),
    ]


class WorkflowCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, workflow_id: str | UUID) -> Workflow | None:
        if not is_valid_uuid(workflow_id):
            raise ValueError(f"Invalid UUID: {workflow_id}")

        statement = select(Workflow).where(Workflow.id == workflow_id).options(*_workflow_load_options())
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Workflow]:
        statement = (
            select(Workflow)
            .join(User, Workflow.created_by == User.id)
            .options(*_workflow_load_options())
            .order_by(Workflow.created_at.desc())
        )

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

    async def create(self, data: dict[str, Any]) -> Workflow:
        steps_data = data.pop("steps", [])
        integration_ids = data.pop("integration_ids", [])
        secret_ids = data.pop("secret_ids", [])

        workflow = Workflow(**data)
        workflow.integration_ids = await self._resolve_integrations(integration_ids)
        workflow.secret_ids = await self._resolve_secrets(secret_ids)
        self.session.add(workflow)
        await self.session.flush()

        for step_data in steps_data:
            step_integration_ids = step_data.pop("integration_ids", [])
            step_secret_ids = step_data.pop("secret_ids", [])
            step = WorkflowStep(workflow_id=workflow.id, **step_data)
            step.integration_ids = await self._resolve_integrations(step_integration_ids)
            step.secret_ids = await self._resolve_secrets(step_secret_ids)
            self.session.add(step)
        await self.session.flush()

        return await self.get_by_id(workflow.id)  # type: ignore

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

        for key, value in data.items():
            if hasattr(step, key):
                setattr(step, key, value)
        await self.session.flush()
        return step

    async def update(self, workflow_id: UUID, data: dict[str, Any]) -> Workflow | None:
        execution = await self.get_by_id(workflow_id)
        if execution is None:
            return None

        if "integration_ids" in data:
            execution.integration_ids = await self._resolve_integrations(data.pop("integration_ids"))
        if "secret_ids" in data:
            execution.secret_ids = await self._resolve_secrets(data.pop("secret_ids"))

        for key, value in data.items():
            if hasattr(execution, key):
                setattr(execution, key, value)
        await self.session.flush()
        return execution

    async def delete(self, workflow_id: UUID | str) -> None:
        execution = await self.get_by_id(workflow_id)
        if execution:
            await self.session.delete(execution)
            await self.session.flush()
