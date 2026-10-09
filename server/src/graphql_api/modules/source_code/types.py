import uuid
from datetime import datetime
from typing import Any, cast

from sqlalchemy import func, select
import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.source_code_versions.model import SourceCodeVersion
from application.source_codes.crud import SourceCodeCRUD
from application.source_codes.iac import IacModule, sort_environment_names
from application.source_codes.model import SourceCode
from graphql_api.modules.task_queue.types import EntityQueueStatusType, resolve_task_queue_status
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserShortType, UserType


source_code_mapper = StrawberrySQLAlchemyMapper()


@strawberry.type
class IacRegionType:
    name: str
    working_dir: str
    var_files: list[str]


@strawberry.type
class IacEnvironmentType:
    name: str
    # Folder tofu runs in, relative to the repository root ("" is the root).
    working_dir: str
    var_files: list[str]
    # Discovered regions; empty when it is run without regions (or they are set in its settings).
    regions: list[IacRegionType]


@strawberry.type
class IacVariableType:
    name: str
    type: str
    description: str
    # No default, so every run needs a value for it.
    required: bool
    sensitive: bool


@strawberry.type
class IacModuleType:
    name: str
    path: str
    # Empty for a module that is run as is, without environments.
    environments: list[IacEnvironmentType]
    variables: list[IacVariableType]


@source_code_mapper.type(SourceCode)
class SourceCodeType:
    __exclude__ = ["created_by", "integration", "iac_modules"]
    id: uuid.UUID = strawberry.UNSET
    source_code_url: str | None = None
    integration: IntegrationType | None = None

    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "source_code"

    @strawberry.field
    async def task_queue_status(self, info: Info) -> EntityQueueStatusType | None:
        return await resolve_task_queue_status(info, "source_code", self.id)

    @strawberry.field
    def identifier(self) -> str:
        return f"{self.source_code_url}"

    @strawberry.field
    async def source_code_version_count(self, info: Info) -> int:
        session = info.context["session"]
        stmt = select(func.count()).select_from(SourceCodeVersion).where(SourceCodeVersion.source_code_id == self.id)
        result = await session.execute(stmt)
        return result.scalar_one()

    @strawberry.field
    def iac_modules(self) -> list[IacModuleType] | None:
        """Runnable modules discovered on the default branch, null until synced (or not an IaC repository)."""
        # `self` is the SourceCode row here, so this reads the JSON column.
        stored = cast(list[dict[str, Any]] | None, cast(Any, self).iac_modules)
        if stored is None:
            return None
        return [
            IacModuleType(
                name=module.name,
                path=module.path,
                environments=[
                    IacEnvironmentType(
                        name=env.name,
                        working_dir=env.working_dir,
                        var_files=env.var_files,
                        regions=[
                            IacRegionType(name=r.name, working_dir=r.working_dir, var_files=r.var_files)
                            for r in env.regions
                        ],
                    )
                    for env in module.environments
                ],
                variables=[IacVariableType(**variable.model_dump()) for variable in module.variables],
            )
            for module in map(IacModule.model_validate, stored)
        ]

    @strawberry.field
    def iac_environment_names(self) -> list[str]:
        """Names of all environments of the discovered modules, in promotion order."""
        stored = cast(list[dict[str, Any]] | None, cast(Any, self).iac_modules) or []
        names = {env.name for module in map(IacModule.model_validate, stored) for env in module.environments}
        return sort_environment_names(names)

    @strawberry.field
    async def commit_count(self, info: Info) -> int:
        return await SourceCodeCRUD(session=info.context["session"]).count_commits(self.id)


@strawberry.type
class SourceCodeCommitType:
    sha: str
    short_sha: str
    message: str
    description: str
    author_name: str
    author_email: str
    authored_at: datetime
    url: str | None = None
    author: UserShortType | None = None


source_code_mapper.finalize()
