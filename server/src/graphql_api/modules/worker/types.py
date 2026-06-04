from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.workers.model import Worker


worker_mapper = StrawberrySQLAlchemyMapper()


@worker_mapper.type(Worker)
class WorkerType:
    pass


worker_mapper.finalize()
