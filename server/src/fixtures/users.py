from sqlalchemy.ext.asyncio import AsyncSession

from core.users.dependencies import get_user_service
from core.users.schema import UserCreateWithProvider


async def create_user(session: AsyncSession):
    user_service = get_user_service(session=session)

    user = UserCreateWithProvider(
        email="guest_super@test.com",
        identifier="guest_super",
        first_name="Guest",
        last_name="User",
        display_name="Guest User (super)",
        provider="guest",
        deactivated=False,
        description="Guest user for testing",
    )

    instance = await user_service.create_user_if_not_exists(user)
    await session.commit()

    return instance
