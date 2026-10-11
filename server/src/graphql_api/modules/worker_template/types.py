import uuid
from datetime import datetime
from typing import cast

import strawberry
from strawberry.scalars import JSON
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.worker_templates.model import WorkerTemplate
from application.worker_templates.providers import WorkerInstance
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
    details: JSON | None = None

    @classmethod
    def from_instance(cls, instance: WorkerInstance) -> "WorkerInstanceType":
        return cls(
            id=instance.id,
            host=instance.host,
            phase=instance.phase,
            created_at=instance.created_at,
            details=cast(JSON, cast(object, instance.details)),
        )


@strawberry.type
class WorkerInstancesType:
    instances: list[WorkerInstanceType]
    error: str | None = None


@strawberry.type
class WorkerTemplateValidationType:
    is_valid: bool
    message: str | None = None


worker_template_mapper.finalize()
