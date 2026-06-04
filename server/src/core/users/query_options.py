from typing import Any

from sqlalchemy.orm import noload, selectinload

from core.database import FieldSpec, build_load_only
from core.users.model import User


def build_user_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for User based on requested fields.

    Args:
        fields: Nested field specification. None means load all fields/relationships.
    """
    if fields is None:
        return [
            selectinload(User.secondary_accounts),
            selectinload(User.primary_account),
        ]

    opts: list[Any] = build_load_only(User, set(fields.keys()))

    if "secondaryAccounts" in fields or "secondary_accounts" in fields:
        nested = fields.get("secondaryAccounts") or fields.get("secondary_accounts")
        opts.append(selectinload(User.secondary_accounts).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(User.secondary_accounts))

    if "primaryAccount" in fields or "primary_account" in fields:
        nested = fields.get("primaryAccount") or fields.get("primary_account")
        opts.append(selectinload(User.primary_account).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(User.primary_account))

    return opts
