import random

from lorem import get_sentence
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.source_codes.dependencies import get_source_code_service
from application.source_codes.schema import SourceCodeCreate

from application.source_codes.model import SourceCode
from core.constants import ModelStatus
from core.users.model import UserDTO

from fixtures.utils import change_state


async def insert_source_code(session: AsyncSession, user: UserDTO):
    integration_service = get_integration_service(session=session)
    source_code_service = get_source_code_service(session=session)

    integrations = await integration_service.get_all(
        filter={"integration_type": "git", "integration_provider": "git_public"}
    )
    source_code_list = await source_code_service.get_all()

    source_code_urls = [
        "https://github.com/electrolux-oss/infrakitchen-example-templates.git",
    ]

    for source in source_code_urls:
        if source in [src.source_code_url for src in source_code_list]:
            continue

        src = SourceCodeCreate(
            description=get_sentence(),
            source_code_url=source,
            source_code_language="opentofu",
            source_code_provider="git_public",
            integration_id=random.choice(integrations).id,
            labels=["opentofu", "aws"],
        )

        await source_code_service.create_source_code(src, user)
        await session.commit()
        # Add git tags and branches that can be added only through automation
        statement = update(SourceCode).values(
            git_tags=["dummy-v1.0", "aws-account-v1.0", "aws-redis-iam-v1.0", "aws-redis-v1.0", "aws-vpc-v1.0"],
            git_branches=["origin/main"],
            git_branch_messages={
                "main": "Update ManagedBy tag (#2)",
                "origin": "Update ManagedBy tag (#2)",
                "origin/main": "Update ManagedBy tag (#2)",
            },
            git_folders_map=[
                {
                    "ref": "dummy-v1.0",
                    "folders": [
                        "/",
                        "demo/",
                        "demo/00-dummy/",
                        "demo/01-aws-account/",
                        "demo/02-aws-vpc/",
                        "demo/04-aws-redis-iam/",
                        "demo/03-aws-redis/",
                    ],
                },
                {
                    "ref": "aws-account-v1.0",
                    "folders": [
                        "/",
                        "demo/",
                        "demo/00-dummy/",
                        "demo/01-aws-account/",
                        "demo/02-aws-vpc/",
                        "demo/04-aws-redis-iam/",
                        "demo/03-aws-redis/",
                    ],
                },
                {
                    "ref": "aws-redis-iam-v1.0",
                    "folders": [
                        "/",
                        "demo/",
                        "demo/00-dummy/",
                        "demo/01-aws-account/",
                        "demo/02-aws-vpc/",
                        "demo/04-aws-redis-iam/",
                        "demo/03-aws-redis/",
                    ],
                },
                {
                    "ref": "aws-redis-v1.0",
                    "folders": [
                        "/",
                        "demo/",
                        "demo/00-dummy/",
                        "demo/01-aws-account/",
                        "demo/02-aws-vpc/",
                        "demo/04-aws-redis-iam/",
                        "demo/03-aws-redis/",
                    ],
                },
                {
                    "ref": "aws-vpc-v1.0",
                    "folders": [
                        "/",
                        "demo/",
                        "demo/00-dummy/",
                        "demo/01-aws-account/",
                        "demo/02-aws-vpc/",
                        "demo/04-aws-redis-iam/",
                        "demo/03-aws-redis/",
                    ],
                },
                {
                    "ref": "origin/main",
                    "folders": [
                        "/",
                        "demo/",
                        "demo/00-dummy/",
                        "demo/01-aws-account/",
                        "demo/02-aws-vpc/",
                        "demo/04-aws-redis-iam/",
                        "demo/03-aws-redis/",
                    ],
                },
            ],
        )
        await session.execute(statement)
        await session.commit()

    await change_state(
        session=session,
        entity=SourceCode,
        status=ModelStatus.DONE,
    )
