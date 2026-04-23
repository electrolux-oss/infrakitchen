from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_models import Base
from core.constants.model import ModelState, ModelStatus


async def change_state(
    session: AsyncSession, entity: type[Base], state: ModelState | None = None, status: ModelStatus | None = None
):
    if state is None and status is None:
        return
    if state is None:
        statement = update(entity).values(status=status)
    elif status is None:
        statement = update(entity).values(state=state)
    else:
        statement = update(entity).values(state=state, status=status)

    await session.execute(statement)
    await session.commit()
