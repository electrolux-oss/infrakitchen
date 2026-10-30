import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.workers.model import Worker


worker_mapper = StrawberrySQLAlchemyMapper()


@worker_mapper.type(Worker)
class WorkerType:
    pass


@strawberry.type
class WorkerLogsType:
    logs: str
    error: str | None = None


worker_mapper.finalize()
