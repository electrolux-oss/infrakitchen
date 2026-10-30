from datetime import UTC, datetime, timedelta
import hashlib
import random
from uuid import UUID

from lorem import get_sentence
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.projects.dependencies import get_project_service
from application.service_builds.model import ServiceBuild
from application.services.dependencies import get_service_service
from application.services.schema import ServiceCreate, ServiceUpdate
from application.source_codes.dependencies import get_source_code_service
from application.source_codes.model import SourceCode, SourceCodeCommit
from application.source_codes.schema import SourceCodeCreate
from core.constants import ModelStatus
from core.users.model import UserDTO

APPLICATION_REPOSITORY_URL = "https://github.com/electrolux-oss/infrakitchen.git"
DEFAULT_BRANCH = "main"
ECR_REPOSITORY_URL = "123456789012.dkr.ecr.eu-west-1.amazonaws.com"

COMMIT_MESSAGES = [
    "Add health check endpoint",
    "Bump dependencies",
    "Fix pagination on the services page",
    "Cache project permissions",
    "Retry failed notifications",
    "Add request logging",
    "Initial commit",
]


def _sha(seed: str) -> str:
    return hashlib.sha1(seed.encode()).hexdigest()


async def insert_application_source_code(session: AsyncSession, user: UserDTO) -> SourceCode:
    integration_service = get_integration_service(session=session)
    source_code_service = get_source_code_service(session=session)

    integrations = await integration_service.get_all(
        filter={"integration_type": "git", "integration_provider": "git_public"}
    )
    source_code = await source_code_service.create_source_code(
        SourceCodeCreate(
            description=get_sentence(),
            source_code_url=APPLICATION_REPOSITORY_URL,
            source_code_language="opentofu",
            source_code_provider="git_public",
            repository_type="application",
            integration_id=random.choice(integrations).id,
            labels=["application"],
        ),
        user,
    )
    await session.commit()

    # Commits and sync results normally come from the sync task
    now = datetime.now(UTC)
    session.add_all(
        SourceCodeCommit(
            source_code_id=source_code.id,
            branch=DEFAULT_BRANCH,
            sha=_sha(message),
            position=position,
            message=message,
            author_name=user.identifier,
            author_email=f"{user.identifier}@example.com",
            authored_at=now - timedelta(days=position),
        )
        for position, message in enumerate(COMMIT_MESSAGES)
    )
    await session.execute(
        update(SourceCode)
        .where(SourceCode.id == source_code.id)
        .values(
            status=ModelStatus.DONE,
            default_branch=DEFAULT_BRANCH,
            git_branches=[DEFAULT_BRANCH],
            git_tags=["v1.0.0"],
            git_tag_shas={"v1.0.0": _sha(COMMIT_MESSAGES[2])},
        )
    )
    await session.commit()
    return source_code


async def insert_services(session: AsyncSession, user: UserDTO):
    project_service = get_project_service(session=session)
    service_service = get_service_service(session=session)

    source_code = await insert_application_source_code(session, user)
    projects = await project_service.get_all()

    for project in projects:
        name = f"{project.name}-api"
        service = await service_service.create_service(
            ServiceCreate(
                name=name,
                description=get_sentence(),
                project_id=project.id,
                source_code_id=str(source_code.id),
                labels=["api"],
                owners=[user.id],
            ),
            user,
        )
        await service_service.update_service(str(service.id), ServiceUpdate(version="1.0.0"), user)
        await session.commit()
        insert_service_builds(session, service.id, name, user)
        await session.commit()


def insert_service_builds(session: AsyncSession, service_id: UUID, name: str, user: UserDTO):
    now = datetime.now(UTC)
    builds = [
        (COMMIT_MESSAGES[0], ModelStatus.DONE, "1.0.0"),
        (COMMIT_MESSAGES[1], ModelStatus.ERROR, None),
        (COMMIT_MESSAGES[2], ModelStatus.DONE, None),
    ]
    for age, (message, status, version) in enumerate(builds):
        sha = _sha(message)
        started_at = now - timedelta(hours=age + 1)
        done = status == ModelStatus.DONE
        session.add(
            ServiceBuild(
                service_id=service_id,
                commit_sha=sha,
                version=version,
                image=f"{ECR_REPOSITORY_URL}/{name}:{sha}" if done else None,
                image_digest=f"sha256:{hashlib.sha256(f'{name}{sha}'.encode()).hexdigest()}" if done else None,
                status=status,
                started_at=started_at,
                finished_at=started_at + timedelta(minutes=random.randint(2, 6)),
                created_at=started_at,
                created_by=user.id,
            )
        )
