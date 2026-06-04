from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.logs.model import Log


log_mapper = StrawberrySQLAlchemyMapper()


@log_mapper.type(Log)
class LogType:
    pass


log_mapper.finalize()
