import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.revisions.model import Revision


revision_mapper = StrawberrySQLAlchemyMapper()


@revision_mapper.type(Revision)
class RevisionType:
    id: uuid.UUID = strawberry.UNSET  # type: ignore[assignment]


revision_mapper.finalize()
