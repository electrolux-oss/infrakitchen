from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from strawberry.types import Info

from application.executors.model import Executor
from application.favorites.model import Favorite
from application.integrations.model import Integration
from application.resources.model import Resource
from application.secrets.model import Secret
from application.source_codes.model import SourceCode
from application.source_code_versions.model import SourceCodeVersion
from application.storages.model import Storage
from application.templates.model import Template
from application.workspaces.model import Workspace
from application.workflows.model import Workflow
from core.auth_providers.model import AuthProvider
from core.users.model import User


async def _load_integrations(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(Integration.id, Integration.name).where(Integration.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.name, "_entity_name": "integration"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_resources(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(
        Resource.id,
        Resource.name,
        Resource.status,
        Resource.state,
        Resource.updated_at,
    ).where(Resource.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {
            "id": str(row.id),
            "name": row.name,
            "status": row.status,
            "state": row.state,
            "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
            "_entity_name": "resource",
        }
        for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_storages(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(Storage.id, Storage.name).where(Storage.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.name, "_entity_name": "storage"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_executors(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(
        Executor.id,
        Executor.name,
        Executor.status,
        Executor.state,
        Executor.updated_at,
    ).where(Executor.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {
            "id": str(row.id),
            "name": row.name,
            "status": row.status,
            "state": row.state,
            "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
            "_entity_name": "executor",
        }
        for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_workspaces(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(Workspace.id, Workspace.name).where(Workspace.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.name, "_entity_name": "workspace"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_source_codes(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(SourceCode.id, SourceCode.source_code_url).where(SourceCode.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.source_code_url, "_entity_name": "source_code"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_source_code_versions(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(
        SourceCodeVersion.id,
        SourceCodeVersion.source_code_folder,
        SourceCodeVersion.source_code_version,
        SourceCodeVersion.source_code_branch,
    ).where(SourceCodeVersion.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {
            "id": str(row.id),
            "name": f"{row.source_code_folder}:{row.source_code_version or row.source_code_branch}",
            "_entity_name": "source_code_version",
        }
        for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_templates(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(Template.id, Template.name).where(Template.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.name, "_entity_name": "template"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_auth_providers(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(AuthProvider.id, AuthProvider.name).where(AuthProvider.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.name, "_entity_name": "auth_provider"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_secrets(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(Secret.id, Secret.name).where(Secret.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.name, "_entity_name": "secret"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_workflows(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(Workflow.id, Workflow.action).where(Workflow.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.action, "_entity_name": "workflow"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_users(keys: list[str], session: AsyncSession) -> list[dict[str, Any] | None]:
    stmt = select(User.id, User.identifier).where(User.id.in_(keys))
    result = await session.execute(stmt)
    mapping: dict[str, dict[str, Any]] = {
        str(row.id): {"id": str(row.id), "name": row.identifier, "_entity_name": "user"} for row in result
    }
    return [mapping.get(key) for key in keys]


async def _load_favorite_status_for_component(
    keys: list[str], user_id: str, component_type: str, session: AsyncSession
) -> list[bool]:
    """Load favorite status for a component type for a specific user."""
    stmt = select(Favorite.component_id).where(
        Favorite.user_id == user_id,
        Favorite.component_type == component_type,
        Favorite.component_id.in_(keys),
    )
    result = await session.execute(stmt)
    favorited_ids = {str(row[0]) for row in result}
    return [key in favorited_ids for key in keys]


def get_favorite_status_loader(info: Info, user_id: str, component_type: str) -> DataLoader[str, bool]:
    """Get or create a DataLoader for component favorite status."""
    loaders = info.context["loaders"]
    loader_key = f"favorite_status:{component_type}:{user_id}"
    if loader_key not in loaders:
        session = info.context["session"]
        loaders[loader_key] = DataLoader[str, bool](
            load_fn=lambda keys: _load_favorite_status_for_component(list(keys), user_id, component_type, session)
        )
    return loaders[loader_key]


def entity_loaders(session: AsyncSession) -> dict[str, DataLoader[str, dict[str, Any] | None]]:
    return {
        "integration": DataLoader[str, dict[str, Any] | None](
            load_fn=lambda keys: _load_integrations(list(keys), session)
        ),
        "resource": DataLoader[str, dict[str, Any] | None](load_fn=lambda keys: _load_resources(list(keys), session)),
        "storage": DataLoader[str, dict[str, Any] | None](load_fn=lambda keys: _load_storages(list(keys), session)),
        "executor": DataLoader[str, dict[str, Any] | None](load_fn=lambda keys: _load_executors(list(keys), session)),
        "workspace": DataLoader[str, dict[str, Any] | None](load_fn=lambda keys: _load_workspaces(list(keys), session)),
        "source_code": DataLoader[str, dict[str, Any] | None](
            load_fn=lambda keys: _load_source_codes(list(keys), session)
        ),
        "source_code_version": DataLoader[str, dict[str, Any] | None](
            load_fn=lambda keys: _load_source_code_versions(list(keys), session)
        ),
        "template": DataLoader[str, dict[str, Any] | None](load_fn=lambda keys: _load_templates(list(keys), session)),
        "auth_provider": DataLoader[str, dict[str, Any] | None](
            load_fn=lambda keys: _load_auth_providers(list(keys), session)
        ),
        "secret": DataLoader[str, dict[str, Any] | None](load_fn=lambda keys: _load_secrets(list(keys), session)),
        "workflow": DataLoader[str, dict[str, Any] | None](load_fn=lambda keys: _load_workflows(list(keys), session)),
        "user": DataLoader[str, dict[str, Any] | None](load_fn=lambda keys: _load_users(list(keys), session)),
    }
