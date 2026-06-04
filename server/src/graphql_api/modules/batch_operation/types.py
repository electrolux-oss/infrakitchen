from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.batch_operations.model import BatchOperation

from graphql_api.modules.user.types import UserType


batch_operation_mapper = StrawberrySQLAlchemyMapper()


@batch_operation_mapper.type(BatchOperation)
class BatchOperationType:
    __exclude__ = ["created_by"]

    creator: UserType | None = None


batch_operation_mapper.finalize()
