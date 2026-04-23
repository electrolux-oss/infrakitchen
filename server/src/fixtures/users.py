from typing import Any, NotRequired, TypedDict

from sqlalchemy.ext.asyncio import AsyncSession

from core.users.dependencies import get_user_service
from core.users.model import UserDTO
from core.users.schema import UserCreateWithProvider


class UserFixture(TypedDict):
    email: Any
    identifier: str
    password: NotRequired[Any]
    first_name: str | None
    last_name: str | None
    display_name: str | None
    provider: str
    deactivated: bool
    description: str | None
    secondary_account: NotRequired[str]


user_fixtures: list[UserFixture] = [
    {
        "email": "microsoft@infrakitchen.io",
        "identifier": "microsoft_user",
        "first_name": "Microsoft",
        "last_name": "User",
        "display_name": "Microsoft User",
        "provider": "microsoft",
        "deactivated": False,
        "description": "Microsoft user for testing",
        "secondary_account": "user:default/microsoft_user_infrakitchen.io",
    },
    {
        "email": "github@infrakitchen.io",
        "identifier": "github_user",
        "first_name": "GitHub",
        "last_name": "User",
        "display_name": "GitHub User",
        "provider": "github",
        "deactivated": False,
        "description": "GitHub user for testing",
        "secondary_account": "user:default/github_user_infrakitchen.io",
    },
    {
        "email": None,
        "identifier": "user:default/microsoft_user_infrakitchen.io",
        "first_name": "Backstage",
        "last_name": "User",
        "display_name": "Backstage User",
        "provider": "backstage",
        "deactivated": False,
        "description": "Backstage user for testing",
    },
    {
        "email": None,
        "identifier": "user:default/github_user_infrakitchen.io",
        "first_name": "Backstage",
        "last_name": "User",
        "display_name": "Backstage User",
        "provider": "backstage",
        "deactivated": False,
        "description": "Backstage user for testing",
    },
    {
        "email": None,
        "identifier": "user:default/guest_super_user_infrakitchen.io",
        "first_name": "Backstage",
        "last_name": "User",
        "display_name": "Backstage User",
        "provider": "backstage",
        "deactivated": False,
        "description": "Backstage user for testing",
    },
    {
        "email": None,
        "identifier": "ik_test_service_account",
        "first_name": "IK Test",
        "last_name": "Service Account",
        "display_name": "IK Test Service Account",
        "provider": "ik_service_account",
        "password": "ik_test_service_account_password",
        "deactivated": False,
        "description": "IK test service account for testing",
    },
]


async def create_guest_super_user(session: AsyncSession):
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


async def create_regular_user(session: AsyncSession, user: UserDTO):
    user_service = get_user_service(session=session)
    for user_data in user_fixtures:
        new_user = UserCreateWithProvider.model_validate(user_data)
        await user_service.create_user_if_not_exists(new_user)
    await session.commit()
    await assign_secondary_account(session, user)


async def assign_secondary_account(session: AsyncSession, user: UserDTO):
    user_service = get_user_service(session=session)
    for user_data in user_fixtures:
        if "secondary_account" in user_data:
            primary_user = await user_service.get_user_by_identifier(user_data["identifier"])
            if primary_user:
                secondary_user = await user_service.get_user_by_identifier(user_data["secondary_account"])
                if secondary_user:
                    await user_service.link_accounts(primary_user.id, secondary_user.id, user)
    await session.commit()
