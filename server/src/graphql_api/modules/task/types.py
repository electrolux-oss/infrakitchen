from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper
from strawberry.scalars import JSON
from strawberry.types import Info
import strawberry

from core.tasks.model import TaskEntity
from graphql_api.modules.user.types import UserType


task_mapper = StrawberrySQLAlchemyMapper()


@task_mapper.type(TaskEntity)
class TaskType:
    __exclude__ = ["created_by"]
    entity: str = ""
    entity_id: str = ""

    @strawberry.field
    def entity_name(self) -> str:
        return "task"

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        loader = info.context["loaders"].get(self.entity)
        if loader is None:
            return None
        return await loader.load(str(self.entity_id))

    creator: UserType | None = None


task_mapper.finalize()
