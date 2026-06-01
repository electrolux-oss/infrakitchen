from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from graphql_api.dataloaders.entity_loaders import entity_loaders
from graphql_api.dataloaders.count_loaders import count_loaders


def create_entity_loaders(session: AsyncSession | Any) -> dict[str, DataLoader[str, Any]]:
    loaders: dict[str, DataLoader[str, Any]] = {}
    loaders.update(entity_loaders(session))
    loaders.update(count_loaders(session))
    return loaders
