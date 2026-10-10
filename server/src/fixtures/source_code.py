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

# Folders of the example templates repo at the commits its refs point to
_TEST_FOLDERS = [
    "test/",
    "test/01-variable-types/",
    "test/02-long-running/",
    "test/03-intentional-failure/",
    "test/04-parent-child-outputs/",
    "test/04-parent-child-outputs/child/",
    "test/04-parent-child-outputs/parent/",
    "test/05-terraform-opentofu-compat/",
]
_AWS_DEMO_FOLDERS = [
    "demo/",
    "demo/01-aws-account/",
    "demo/02-aws-vpc/",
    "demo/03-aws-redis/",
    "demo/04-aws-redis-iam/",
]
_DUMMY_DEMO_FOLDERS = [
    "demo/",
    "demo/00-dummy/",
    "demo/01-aws-account/",
    "demo/02-aws-vpc/",
    "demo/03-aws-redis/",
    "demo/04-aws-redis-iam/",
]
_DUMMY_MODULE_FOLDERS = [
    "dummy/",
    "dummy/01-account/",
    "dummy/02-vpc/",
    "dummy/03-redis/",
    "dummy/04-redis-iam/",
    "dummy/05-eks/",
    "dummy/06-rds-postgres/",
    "dummy/07-eks-namespace/",
    "dummy/08-eks-service-account/",
    "dummy/09-rds-postgres-credentials/",
]
# "Update ManagedBy tag (#2)"
AWS_DEMO_FOLDERS = ["/", *_AWS_DEMO_FOLDERS, *_TEST_FOLDERS]
# "Merge pull request #4 from electrolux-oss/dummy_module"
DUMMY_DEMO_FOLDERS = ["/", *_DUMMY_DEMO_FOLDERS, *_TEST_FOLDERS]
# "Merge pull request #5 from electrolux-oss/dummy_modules", the current main
DUMMY_MODULES_FOLDERS = ["/", *_DUMMY_DEMO_FOLDERS, *_DUMMY_MODULE_FOLDERS, *_TEST_FOLDERS]

# Tag -> folders available at it; fixture source code versions use the tags of the catalog
GIT_TAG_FOLDERS: dict[str, list[str]] = {
    "aws-account-v1.0": AWS_DEMO_FOLDERS,
    "aws-vpc-v1.0": AWS_DEMO_FOLDERS,
    "aws-redis-v1.0": AWS_DEMO_FOLDERS,
    "aws-redis-iam-v1.0": AWS_DEMO_FOLDERS,
    "dummy-v1.0": DUMMY_DEMO_FOLDERS,
    **{
        tag: DUMMY_MODULES_FOLDERS
        for tag in (
            "account-v1.0",
            "vpc-v1.0",
            "redis-v1.0",
            "redis-iam-v1.0",
            "eks-v1.0",
            "rds-postgres-v1.0",
            "eks-namespace-v1.0",
            "eks-service-account-v1.0",
            "rds-postgres-credentials-v1.0",
        )
    },
}
MAIN_BRANCH = "origin/main"
MAIN_BRANCH_MESSAGE = "Merge pull request #5 from electrolux-oss/dummy_modules"


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
            labels=["opentofu", "dummy"],
        )

        await source_code_service.create_source_code(src, user)
        await session.commit()
        # Add git tags and branches that can be added only through automation
        statement = update(SourceCode).values(
            git_tags=list(GIT_TAG_FOLDERS),
            git_branches=[MAIN_BRANCH],
            git_branch_messages={
                "main": MAIN_BRANCH_MESSAGE,
                "origin": MAIN_BRANCH_MESSAGE,
                MAIN_BRANCH: MAIN_BRANCH_MESSAGE,
            },
            git_folders_map=[
                *({"ref": tag, "folders": folders} for tag, folders in GIT_TAG_FOLDERS.items()),
                {"ref": MAIN_BRANCH, "folders": DUMMY_MODULES_FOLDERS},
            ],
        )
        await session.execute(statement)
        await session.commit()

    await change_state(
        session=session,
        entity=SourceCode,
        status=ModelStatus.DONE,
    )
