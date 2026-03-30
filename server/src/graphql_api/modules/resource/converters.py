from typing import Any

from sqlalchemy.orm import selectinload

from application.resources.model import Resource
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.integration.converters import convert_integration
from graphql_api.modules.resource.types import ResourceType
from graphql_api.modules.secret.converters import convert_secret
from graphql_api.modules.source_code_version.converters import convert_source_code_version
from graphql_api.modules.storage.converters import convert_storage
from graphql_api.modules.template.converters import convert_template
from graphql_api.modules.user.converters import convert_user
from graphql_api.modules.workspace.converters import convert_workspace


def resource_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(Resource, fields)
    if "integrationIds" in fields:
        opts.append(selectinload(Resource.integration_ids))
    if "secretIds" in fields:
        opts.append(selectinload(Resource.secret_ids))
    if "parents" in fields:
        opts.append(selectinload(Resource.parents).noload("*"))
    if "children" in fields:
        opts.append(selectinload(Resource.children).noload("*"))
    if "template" in fields:
        opts.append(selectinload(Resource.template).noload("*"))
    if "workspace" in fields:
        opts.append(selectinload(Resource.workspace).noload("*"))
    if "sourceCodeVersion" in fields:
        opts.append(selectinload(Resource.source_code_version).noload("*"))
    if "storage" in fields:
        opts.append(selectinload(Resource.storage).noload("*"))
    return opts


def _convert_resource_shallow(obj: Any) -> ResourceType:
    """Convert a Resource ORM object using only column attributes."""
    return ResourceType(
        id=obj.id,
        name=obj.name,
        description=obj.description,
        template_id=obj.template_id,
        template=None,
        source_code_version_id=obj.source_code_version_id,
        source_code_version=None,
        integration_ids=[],
        secret_ids=[],
        storage_id=obj.storage_id,
        storage=None,
        storage_path=obj.storage_path,
        variables=obj.variables,
        outputs=obj.outputs,
        dependency_tags=obj.dependency_tags,
        dependency_config=obj.dependency_config,
        parents=[],
        children=[],
        labels=obj.labels,
        abstract=obj.abstract,
        workspace_id=obj.workspace_id,
        workspace=None,
        state=enum_val(obj.state),
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


def convert_resource(obj: Any, fields: set[str] | None = None) -> ResourceType:
    if fields is not None:
        obj = SafeORM(obj)
    return ResourceType(
        id=obj.id,
        name=obj.name,
        description=obj.description,
        template_id=obj.template_id,
        template=(convert_template(getattr(obj, "template", None)) if fields is None or "template" in fields else None),
        source_code_version_id=obj.source_code_version_id,
        source_code_version=(
            convert_source_code_version(getattr(obj, "source_code_version", None))
            if fields is None or "sourceCodeVersion" in fields
            else None
        ),
        integration_ids=(
            [x for x in (convert_integration(i) for i in getattr(obj, "integration_ids", []) or []) if x is not None]
            if fields is None or "integrationIds" in fields
            else []
        ),
        secret_ids=(
            [x for x in (convert_secret(s) for s in getattr(obj, "secret_ids", []) or []) if x is not None]
            if fields is None or "secretIds" in fields
            else []
        ),
        storage_id=obj.storage_id,
        storage=(convert_storage(getattr(obj, "storage", None)) if fields is None or "storage" in fields else None),
        storage_path=obj.storage_path,
        variables=obj.variables,
        outputs=obj.outputs,
        dependency_tags=obj.dependency_tags,
        dependency_config=obj.dependency_config,
        parents=(
            [_convert_resource_shallow(r) for r in getattr(obj, "parents", []) or []]
            if fields is None or "parents" in fields
            else []
        ),
        children=(
            [_convert_resource_shallow(r) for r in getattr(obj, "children", []) or []]
            if fields is None or "children" in fields
            else []
        ),
        labels=obj.labels,
        abstract=obj.abstract,
        workspace_id=obj.workspace_id,
        workspace=(
            convert_workspace(getattr(obj, "workspace", None)) if fields is None or "workspace" in fields else None
        ),
        state=enum_val(obj.state),
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
