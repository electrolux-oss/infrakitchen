from typing import Any

from sqlalchemy.orm import joinedload, noload, selectinload

from application.executors.model import Executor
from application.integrations.query_options import build_integration_query_options
from application.secrets.query_options import build_secret_query_options
from application.source_codes.query_options import build_source_code_query_options
from application.storages.query_options import build_storage_query_options
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_executor_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Executor based on requested fields."""
    if fields is None:
        return [
            selectinload(Executor.integration_ids),
            selectinload(Executor.secret_ids),
            joinedload(Executor.source_code),
            joinedload(Executor.storage),
            joinedload(Executor.creator),
        ]

    opts: list[Any] = build_load_only(Executor, set(fields.keys()))

    if "integrationIds" in fields or "integration_ids" in fields:
        nested = fields.get("integrationIds") or fields.get("integration_ids")
        opts.append(selectinload(Executor.integration_ids).options(*build_integration_query_options(nested)))
    else:
        opts.append(noload(Executor.integration_ids))

    if "secretIds" in fields or "secret_ids" in fields:
        nested = fields.get("secretIds") or fields.get("secret_ids")
        opts.append(selectinload(Executor.secret_ids).options(*build_secret_query_options(nested)))
    else:
        opts.append(noload(Executor.secret_ids))

    if "sourceCode" in fields or "source_code" in fields:
        nested = fields.get("sourceCode") or fields.get("source_code")
        opts.append(joinedload(Executor.source_code).options(*build_source_code_query_options(nested)))
    else:
        opts.append(noload(Executor.source_code))

    if "storage" in fields:
        nested = fields["storage"]
        opts.append(joinedload(Executor.storage).options(*build_storage_query_options(nested)))
    else:
        opts.append(noload(Executor.storage))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Executor.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Executor.creator))

    return opts
