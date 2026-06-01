from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from strawberry.types import Info
from strawberry.types.nodes import SelectedField

from core.users.model import User
from core.users.query_options import build_user_query_options
from graphql_api.helpers import build_field_spec, get_entity_selection


def user_options(selected_field: SelectedField | None) -> list[Any]:
    """Build SQLAlchemy loading options from a GraphQL SelectedField."""
    return build_user_query_options(build_field_spec(selected_field))


async def _load_user_types(
    keys: list[str],
    session: AsyncSession,
    selected_field: SelectedField | None = None,
) -> list[User | None]:
    stmt = select(User).where(User.id.in_(keys))
    opts = user_options(selected_field)
    if opts:
        stmt = stmt.options(*opts)
    result = await session.execute(stmt)
    mapping = {str(u.id): u for u in result.scalars().all()}
    return [mapping.get(key) for key in keys]


def get_user_type_loader(info: Info, field_name: str = "userData") -> DataLoader[str, User | None]:
    loaders = info.context["loaders"]
    loader_key = f"user_type:{field_name}"
    if loader_key not in loaders:
        session = info.context["session"]
        selected = get_entity_selection(info.selected_fields, field_name)
        loaders[loader_key] = DataLoader[str, User | None](
            load_fn=lambda keys: _load_user_types(list(keys), session, selected)
        )
    return loaders[loader_key]
