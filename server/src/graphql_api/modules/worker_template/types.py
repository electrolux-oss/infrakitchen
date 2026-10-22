import uuid
from datetime import datetime
from typing import cast

import strawberry
from strawberry.scalars import JSON
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.worker_templates.model import WorkerTemplate
from application.worker_templates.providers import WorkerInstance
from core.workers.model import Worker
from graphql_api.modules.user.types import UserType


worker_template_mapper = StrawberrySQLAlchemyMapper()


@worker_template_mapper.type(WorkerTemplate)
class WorkerTemplateType:
    __exclude__ = ["created_by"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "worker_template"


@strawberry.type
class WorkerInstanceType:
    id: str
    host: str
    phase: str
    created_at: datetime | None = None
    finished_at: datetime | None = None
    reason: str | None = None
    details: JSON | None = None
    # The worker registered from this instance, if any
    worker_id: uuid.UUID | None = None
    worker_status: str | None = None
    current_task: JSON | None = None
    tasks_completed: int | None = None

    @classmethod
    def from_instance(cls, instance: WorkerInstance, worker: Worker | None = None) -> "WorkerInstanceType":
        return cls(
            id=instance.id,
            host=instance.host,
            phase=instance.phase,
            created_at=instance.created_at,
            finished_at=instance.finished_at,
            reason=instance.reason,
            details=cast(JSON, cast(object, instance.details)),
            worker_id=worker.id if worker else None,
            worker_status=worker.status if worker else None,
            current_task=cast(JSON, cast(object, worker.current_task)) if worker else None,
            tasks_completed=worker.tasks_completed if worker else None,
        )


@strawberry.type
class WorkerInstancesType:
    instances: list[WorkerInstanceType]
    error: str | None = None


@strawberry.type
class WorkerInstanceLogsType:
    logs: str
    error: str | None = None


@strawberry.type
class WorkerInstanceManifestType:
    manifest: JSON | None = None
    error: str | None = None


@strawberry.type
class WorkerTemplateValidationType:
    is_valid: bool
    message: str | None = None


worker_template_mapper.finalize()
