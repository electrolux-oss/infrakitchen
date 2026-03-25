from typing import Any

from sqlalchemy.orm import selectinload

from application.executors.model import Executor
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.executor.types import ExecutorType
from graphql_api.modules.integration.converters import convert_integration
from graphql_api.modules.secret.converters import convert_secret
from graphql_api.modules.source_code.converters import convert_source_code
from graphql_api.modules.storage.converters import convert_storage
from graphql_api.modules.user.converters import convert_user


def executor_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(Executor, fields)
    if "integrationIds" in fields:
        opts.append(selectinload(Executor.integration_ids))
    if "secretIds" in fields:
        opts.append(selectinload(Executor.secret_ids))
    if "sourceCode" in fields:
        opts.append(selectinload(Executor.source_code).noload("*"))
    if "storage" in fields:
        opts.append(selectinload(Executor.storage).noload("*"))
    return opts


def convert_executor(obj: Any, fields: set[str] | None = None) -> ExecutorType:
    if fields is not None:
        obj = SafeORM(obj)
    return ExecutorType(
        id=obj.id,
        name=obj.name,
        description=obj.description,
        runtime=obj.runtime,
        command_args=obj.command_args,
        source_code_id=obj.source_code_id,
        source_code=(
            convert_source_code(getattr(obj, "source_code", None)) if fields is None or "sourceCode" in fields else None
        ),
        source_code_version=obj.source_code_version,
        source_code_branch=obj.source_code_branch,
        source_code_folder=obj.source_code_folder,
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
        labels=obj.labels,
        state=enum_val(obj.state),
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
