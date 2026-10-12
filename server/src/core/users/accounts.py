from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.utils.model_tools import is_valid_uuid

from .model import UserDTO, user_account_associations


def primary_user_id(user: UserDTO) -> UUID:
    """Linked secondary accounts act as their primary account."""
    return user.primary_account[0].id if user.primary_account else user.id


async def get_primary_account_ids(session: AsyncSession, user_ids: set[UUID]) -> dict[UUID, UUID]:
    """Map the linked secondary accounts among ``user_ids`` to their primary account."""
    if not user_ids:
        return {}
    statement = select(
        user_account_associations.c.secondary_user_id, user_account_associations.c.primary_user_id
    ).where(user_account_associations.c.secondary_user_id.in_(user_ids))
    return {secondary: primary for secondary, primary in (await session.execute(statement)).all()}


async def resolve_primary_ids(session: AsyncSession, user_ids: Iterable[UUID | str | None]) -> dict[UUID, UUID]:
    """Map every valid ID in ``user_ids`` to its primary account (itself when it isn't linked)."""
    ids = {UUID(str(user_id)) for user_id in user_ids if user_id and is_valid_uuid(str(user_id))}
    primary_ids = await get_primary_account_ids(session, ids)
    return {user_id: primary_ids.get(user_id, user_id) for user_id in ids}
