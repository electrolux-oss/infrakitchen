import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.source_codes.dependencies import get_source_code_service
from application.source_codes.service import SourceCodeService
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.source_code.types import SourceCodeCommitType, SourceCodeType
from graphql_api.modules.user.types import UserShortType


def _build_service(info: Info) -> SourceCodeService:
    session = info.context["session"]
    return get_source_code_service(session=session)


@strawberry.type
class SourceCodeQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code(self, info: Info, id: uuid.UUID) -> SourceCodeType | None:
        await check_api_permission(info, "source_code", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "sourceCode")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_codes(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[SourceCodeType]:
        await check_api_permission(info, "source_code", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "sourceCodes")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_codes_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "source_code", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        await check_api_permission(info, "source_code", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(source_code_id=id, requester=requester)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_commits(
        self,
        info: Info,
        id: uuid.UUID,
        branch: str | None = None,
        range: list[int] | None = None,
    ) -> list[SourceCodeCommitType]:
        await check_api_permission(info, "source_code", ["read"])
        service = _build_service(info)
        commits = await service.get_commits(id, branch=branch, range=parse_range(range))
        return [
            SourceCodeCommitType(
                **commit.model_dump(exclude={"author"}),
                author=UserShortType(
                    id=commit.author.id, identifier=commit.author.identifier, provider=commit.author.provider
                )
                if commit.author
                else None,
            )
            for commit in commits
        ]

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_commits_count(
        self,
        info: Info,
        id: uuid.UUID,
        branch: str | None = None,
    ) -> int:
        await check_api_permission(info, "source_code", ["read"])
        service = _build_service(info)
        return await service.count_commits(id, branch=branch)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_commit_index(
        self,
        info: Info,
        id: uuid.UUID,
        sha: str,
        branch: str | None = None,
    ) -> int | None:
        await check_api_permission(info, "source_code", ["read"])
        service = _build_service(info)
        return await service.get_commit_index(id, sha, branch=branch)
