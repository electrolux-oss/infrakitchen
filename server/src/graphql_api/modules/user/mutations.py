import uuid

import strawberry
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from core.errors import AccessDenied
from core.users.dependencies import get_user_service
from core.users.functions import user_is_super_admin
from core.users.schema import UserCreate, UserUpdate
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.user.types import UserType


@strawberry_pydantic.input(model=UserCreate, all_fields=False)
class UserCreateInput:
    identifier: str = strawberry.UNSET
    description: str = ""
    password: str | None = None


@strawberry_pydantic.input(model=UserUpdate, all_fields=True)
class UserUpdateInput:
    password: str | None = None


@strawberry.type
class UserMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_user(self, info: Info, input: UserCreateInput) -> UserType:
        requester = info.context["request"].state.user
        if await user_is_super_admin(requester) is False:
            raise AccessDenied("Access denied")

        session = info.context["session"]
        service = get_user_service(session=session)
        return await service.create_user(user=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_user(self, info: Info, id: uuid.UUID, body: UserUpdateInput) -> UserType:
        requester = info.context["request"].state.user
        if await user_is_super_admin(requester) is False:
            raise AccessDenied("Access denied")

        session = info.context["session"]
        service = get_user_service(session=session)
        user_update = body.to_pydantic()
        return await service.update_entity(user_id=id, user=user_update, requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def link_user_account(self, info: Info, primary_user_id: uuid.UUID, secondary_user_id: uuid.UUID) -> UserType:
        requester = info.context["request"].state.user
        if await user_is_super_admin(requester) is False:
            raise AccessDenied("Access denied")

        session = info.context["session"]
        service = get_user_service(session=session)
        return await service.link_accounts(
            primary_user_id=primary_user_id, secondary_user_id=secondary_user_id, requester=requester
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def unlink_user_account(
        self, info: Info, primary_user_id: uuid.UUID, secondary_user_id: uuid.UUID
    ) -> UserType:
        requester = info.context["request"].state.user
        if await user_is_super_admin(requester) is False:
            raise AccessDenied("Access denied")

        session = info.context["session"]
        service = get_user_service(session=session)
        return await service.unlink_accounts(
            primary_user_id=primary_user_id, secondary_user_id=secondary_user_id, requester=requester
        )
