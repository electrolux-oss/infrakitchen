from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import Column, Table, delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


from core.base_models import Base
from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid

from .model import User
from .query_options import build_user_query_options

# Rows that only exist for the user (personal data and activity history).
# They are deleted together with a service account.
USER_OWNED_TABLES = frozenset(
    {
        "audit_logs",
        "favorites",
        "personal_access_tokens",
        "project_owners",
        "resources_temp_state",
        "service_owners",
        "tasks",
        "user_accounts_associations",
    }
)

ReferencePolicy = Literal["delete", "clear", "block"]


@dataclass(frozen=True)
class UserReference:
    table: Table
    column: Column[Any]
    policy: ReferencePolicy


def get_user_references() -> list[UserReference]:
    """
    Every column that points at users.id and what deleting a user means for it:
    - delete: the row belongs to the user and is removed
    - clear: the column is nullable and is set to NULL
    - block: the row is an entity created by the user, so the user can't be deleted
    """
    users_table = User.__table__
    references: list[UserReference] = []
    for table in Base.metadata.sorted_tables:
        for fk in table.foreign_keys:
            if fk.column.table is not users_table:
                continue
            column = fk.parent
            ondelete = (fk.ondelete or "").upper()
            if table.name in USER_OWNED_TABLES or ondelete == "CASCADE":
                policy: ReferencePolicy = "delete"
            elif column.nullable or ondelete == "SET NULL":
                policy = "clear"
            else:
                policy = "block"
            references.append(UserReference(table=table, column=column, policy=policy))
    return references


class UserCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        user_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> User | None:
        if not is_valid_uuid(user_id):
            raise ValueError(f"Invalid UUID: {user_id}")

        statement = select(User).where(User.id == user_id)
        statement = statement.options(*build_user_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_one(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> User | None:
        statement = select(User)
        statement = evaluate_sqlalchemy_filters(User, statement, filter)
        statement = evaluate_sqlalchemy_sorting(User, statement, sort)

        statement = statement.options(selectinload(User.secondary_accounts), selectinload(User.primary_account))
        result = await self.session.execute(statement)
        return result.scalars().first()

    async def get_by_identifier(self, identifier: str) -> User | None:
        # Identifiers are emails for SSO providers, which are case-insensitive
        statement = select(User).where(func.lower(User.identifier) == identifier.lower())
        statement = statement.options(selectinload(User.secondary_accounts), selectinload(User.primary_account))
        result = await self.session.execute(statement)
        return result.scalars().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[User]:
        statement = select(User)
        statement = evaluate_sqlalchemy_filters(User, statement, filter)
        statement = evaluate_sqlalchemy_sorting(User, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(*build_user_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(User)
        statement = evaluate_sqlalchemy_filters(User, statement, filter)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> User:
        db_user = User(**body)
        self.session.add(db_user)
        await self.session.flush()
        return db_user

    async def update(self, existing_user: User, body: dict[str, Any]) -> User:
        for key, value in body.items():
            if key not in {"secondary_accounts"} and hasattr(existing_user, key):
                setattr(existing_user, key, value)

        if "secondary_accounts" in body:
            secondary_body_ids = body.pop("secondary_accounts")
            user_objects = await self.session.execute(select(User).where(User.id.in_(secondary_body_ids)))
            secondary_ids = user_objects.scalars().all()
            if not len(secondary_ids) == len(secondary_body_ids):
                raise ValueError("Some user ids were not found")

            existing_user.secondary_accounts = list(secondary_ids)

        return existing_user

    async def delete(self, user: User) -> None:
        # Savepoint so a foreign-key violation doesn't break the outer transaction
        async with self.session.begin_nested():
            await self.session.delete(user)

    async def get_deletion_impact(self, user_id: str | UUID) -> dict[ReferencePolicy, dict[str, int]]:
        """Count rows per table that deleting the user would delete, clear or that block the deletion."""
        impact: dict[ReferencePolicy, dict[str, int]] = {"delete": {}, "clear": {}, "block": {}}
        for ref in get_user_references():
            count = await self.session.scalar(select(func.count()).select_from(ref.table).where(ref.column == user_id))
            if count:
                group = impact[ref.policy]
                group[ref.table.name] = group.get(ref.table.name, 0) + count

        rules = await self.session.scalar(
            text("SELECT count(*) FROM casbin_rules WHERE v0 = :subject"), {"subject": f"user:{user_id}"}
        )
        if rules:
            impact["delete"]["casbin_rules"] = rules
        return impact

    async def delete_user_references(self, user_id: str | UUID) -> None:
        """Delete rows owned by the user and clear nullable references to it. Blocking references are left as is."""
        for ref in get_user_references():
            if ref.policy == "delete":
                await self.session.execute(delete(ref.table).where(ref.column == user_id))
            elif ref.policy == "clear":
                await self.session.execute(
                    update(ref.table).where(ref.column == user_id).values({ref.column.name: None})
                )
        await self.session.execute(text("DELETE FROM casbin_rules WHERE v0 = :subject"), {"subject": f"user:{user_id}"})

    async def refresh(self, user: User) -> None:
        await self.session.refresh(user)
