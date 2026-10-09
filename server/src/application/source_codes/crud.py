from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, insert, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from application.executors.model import Executor
from application.integrations.model import Integration
from application.source_code_versions.model import SourceCodeVersion
from core.tools.git_client import GitCommit
from core.users.model import User

from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid

from .model import SourceCode, SourceCodeCommit
from .query_options import build_source_code_query_options


COMMIT_INSERT_BATCH_SIZE = 1000


@dataclass
class CommitFilter:
    branch: str | None = None


class SourceCodeCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        source_code_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> SourceCode | None:
        if not is_valid_uuid(source_code_id):
            raise ValueError(f"Invalid UUID: {source_code_id}")

        statement = select(SourceCode).where(SourceCode.id == source_code_id)
        statement = statement.options(*build_source_code_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_one(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> SourceCode | None:
        statement = (
            select(SourceCode)
            .join(User, SourceCode.created_by == User.id)
            .outerjoin(Integration, SourceCode.integration_id == Integration.id)
        )
        statement = evaluate_sqlalchemy_filters(SourceCode, statement, filter)
        statement = evaluate_sqlalchemy_sorting(SourceCode, statement, sort)

        result = await self.session.execute(statement)
        return result.scalars().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[SourceCode]:
        statement = select(SourceCode)
        statement = evaluate_sqlalchemy_filters(SourceCode, statement, filter)
        statement = evaluate_sqlalchemy_sorting(SourceCode, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(*build_source_code_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(SourceCode)
        statement = evaluate_sqlalchemy_filters(SourceCode, statement, filter)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> SourceCode:
        db_source_code = SourceCode(**body)
        self.session.add(db_source_code)
        await self.session.flush()
        return db_source_code

    async def update(self, existing_source_code: SourceCode, body: dict[str, Any]) -> SourceCode:
        for key, value in body.items():
            setattr(existing_source_code, key, value)

        return existing_source_code

    async def delete(self, source_code: SourceCode) -> None:
        await self.session.delete(source_code)

    async def get_dependencies(self, existing_source_code: SourceCode) -> list[Any]:
        scv_statement = select(
            SourceCodeVersion.id.label("id"),
            literal("source_code_version").label("type"),
            SourceCodeVersion.source_code_folder.label("name"),
        ).where(SourceCodeVersion.source_code_id == existing_source_code.id)

        executor_statement = select(
            Executor.id.label("id"),
            literal("executor").label("type"),
            Executor.name.label("name"),
        ).where(Executor.source_code_id == existing_source_code.id)
        combined_statement = union_all(scv_statement, executor_statement)
        result = await self.session.execute(combined_statement)
        return list(result.fetchall())

    async def refresh(self, source_code: SourceCode) -> None:
        await self.session.refresh(source_code)

    @staticmethod
    def _commit_rows(
        source_code_id: UUID, branch: str, commits: list[GitCommit], first_position: int
    ) -> list[dict[str, Any]]:
        return [
            {
                "source_code_id": source_code_id,
                "branch": branch,
                "sha": commit.sha,
                "position": first_position + offset,
                "message": commit.message,
                "description": commit.description,
                "author_name": commit.author_name,
                "author_email": commit.author_email,
                "authored_at": commit.authored_at,
            }
            for offset, commit in enumerate(commits)
        ]

    async def _insert_commit_rows(self, rows: list[dict[str, Any]]) -> None:
        for start in range(0, len(rows), COMMIT_INSERT_BATCH_SIZE):
            _ = await self.session.execute(insert(SourceCodeCommit), rows[start : start + COMMIT_INSERT_BATCH_SIZE])

    async def replace_commits(self, source_code_id: UUID, branch: str, commits: list[GitCommit]) -> None:
        await self.delete_commits(source_code_id, branch=branch)
        await self._insert_commit_rows(self._commit_rows(source_code_id, branch, commits, first_position=0))

    async def prepend_commits(self, source_code_id: UUID, branch: str, commits: list[GitCommit]) -> None:
        if not commits:
            return
        lowest = await self.session.execute(
            select(func.min(SourceCodeCommit.position)).where(
                SourceCodeCommit.source_code_id == source_code_id, SourceCodeCommit.branch == branch
            )
        )
        first_position = (lowest.scalar_one_or_none() or 0) - len(commits)
        await self._insert_commit_rows(self._commit_rows(source_code_id, branch, commits, first_position))

    async def get_head_commit_sha(self, source_code_id: UUID | str, branch: str) -> str | None:
        result = await self.session.execute(
            select(SourceCodeCommit.sha)
            .where(SourceCodeCommit.source_code_id == source_code_id, SourceCodeCommit.branch == branch)
            .order_by(SourceCodeCommit.position)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def delete_commits_except(self, source_code_id: UUID | str, branch: str) -> None:
        _ = await self.session.execute(
            delete(SourceCodeCommit).where(
                SourceCodeCommit.source_code_id == source_code_id, SourceCodeCommit.branch != branch
            )
        )

    async def delete_commits(self, source_code_id: UUID | str, branch: str | None = None) -> None:
        statement = delete(SourceCodeCommit).where(SourceCodeCommit.source_code_id == source_code_id)
        if branch is not None:
            statement = statement.where(SourceCodeCommit.branch == branch)
        _ = await self.session.execute(statement)

    @staticmethod
    def _commit_condition(source_code_id: UUID | str, commit_filter: CommitFilter) -> Any:
        if commit_filter.branch is None:
            default_branch = select(SourceCode.default_branch).where(SourceCode.id == source_code_id)
            branch_condition = SourceCodeCommit.branch == default_branch.scalar_subquery()
        else:
            branch_condition = SourceCodeCommit.branch == commit_filter.branch
        return (SourceCodeCommit.source_code_id == source_code_id) & branch_condition

    async def get_commits(
        self,
        source_code_id: UUID | str,
        commit_filter: CommitFilter | None = None,
        range: tuple[int, int] | None = None,
    ) -> list[SourceCodeCommit]:
        statement = (
            select(SourceCodeCommit)
            .where(self._commit_condition(source_code_id, commit_filter or CommitFilter()))
            .order_by(SourceCodeCommit.position)
        )
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count_commits(self, source_code_id: UUID | str, commit_filter: CommitFilter | None = None) -> int:
        statement = (
            select(func.count())
            .select_from(SourceCodeCommit)
            .where(self._commit_condition(source_code_id, commit_filter or CommitFilter()))
        )
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def get_commit_index(
        self, source_code_id: UUID | str, sha: str, commit_filter: CommitFilter | None = None
    ) -> int | None:
        condition = self._commit_condition(source_code_id, commit_filter or CommitFilter())
        target = await self.session.execute(
            select(SourceCodeCommit.position).where(condition, SourceCodeCommit.sha == sha)
        )
        position = target.scalar_one_or_none()
        if position is None:
            return None
        newer = await self.session.execute(
            select(func.count()).select_from(SourceCodeCommit).where(condition, SourceCodeCommit.position < position)
        )
        return newer.scalar_one()

    async def get_users_by_emails(self, emails: set[str]) -> dict[str, User]:
        if not emails:
            return {}
        result = await self.session.execute(
            select(User)
            .where(func.lower(User.email).in_({email.lower() for email in emails}))
            .options(selectinload(User.primary_account))
            # Active and primary accounts win when several share an email.
            .order_by(User.deactivated, User.is_primary.desc().nulls_last(), User.created_at)
        )
        users: dict[str, User] = {}
        for user in result.scalars().all():
            assert user.email is not None
            _ = users.setdefault(user.email.lower(), user.primary_account[0] if user.primary_account else user)
        return users
