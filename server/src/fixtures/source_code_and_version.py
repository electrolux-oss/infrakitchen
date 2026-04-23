import random

from lorem import get_sentence
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.schema import (
    SourceCodeVersionCreate,
    SourceCodeVersionResponse,
    SourceCodeVersionVariablesCreate,
    SourceConfigCreate,
    SourceOutputConfigCreate,
)
from application.source_codes.dependencies import get_source_code_service
from application.source_codes.schema import SourceCodeCreate
from application.templates.dependencies import get_template_service

from application.source_code_versions.model import SourceCodeVersion
from application.source_codes.model import SourceCode
from core.constants import ModelStatus
from core.users.model import UserDTO

from application import (
    OutputVariableModel,
    VariableModel,
)
from fixtures.logs import generate_logs
from fixtures.utils import change_state


async def insert_source_code_and_version(session: AsyncSession, user: UserDTO):
    template_service = get_template_service(session=session)
    integration_service = get_integration_service(session=session)
    source_code_service = get_source_code_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)

    integrations = await integration_service.get_all(filter={"integration_type": "git"})
    source_code_list = await source_code_service.get_all()

    source_code_urls = [
        "https://github.com/electrolux-oss/networking",
        "https://github.com/electrolux-oss/k8s",
        "https://github.com/electrolux-oss/k8s_namespace",
    ]

    for source in source_code_urls:
        if source in [src.source_code_url for src in source_code_list]:
            continue

        src = SourceCodeCreate(
            description=get_sentence(),
            source_code_url=source,
            source_code_language="opentofu",
            source_code_provider="github",
            integration_id=random.choice(integrations).id,
            labels=["source_code", "github", "opentofu", "aws"],
        )

        sc_result = await source_code_service.create(src, user)
        await session.commit()
        await generate_logs(
            session=session,
            entity_name="source_code",
            entity_id=str(sc_result.id),
            user_id=str(user.id),
        )
        # Add git tags and branches that can be added only through automation
        statement = update(SourceCode).values(
            git_tags=["v1.0.0", "v1.1.0", "v2.0.0"],
            git_branches=["main", "dev", "staging"],
            git_folders_map=[
                {"ref": "v1.0.0", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "v1.1.0", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "v2.0.0", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "main", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "dev", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "staging", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
            ],
        )
        await session.execute(statement)
        await session.commit()

    await change_state(
        session=session,
        entity=SourceCode,
        status=ModelStatus.DONE,
    )
    # insert version
    source_code_list = await source_code_service.get_all()
    source_code_version_list = await source_code_version_service.get_all()

    templates = await template_service.get_all()

    for template in templates:
        if template.id in [version.template.id for version in source_code_version_list]:
            continue

        version = SourceCodeVersionCreate(
            template_id=template.id,
            source_code_id=random.choice(source_code_list).id,
            source_code_version="v1.0.0",
            source_code_folder=f"test/{template.template}",
            description=get_sentence(),
        )
        current_code_version = await source_code_version_service.create(version, user)
        await session.commit()
        await change_state(
            session=session,
            entity=SourceCodeVersion,
            status=ModelStatus.DONE,
        )
        await generate_logs(
            session=session,
            entity_name="source_code_version",
            entity_id=str(current_code_version.id),
            user_id=str(user.id),
        )
        scv_with_variables = SourceCodeVersionVariablesCreate(
            source_code_version_id=str(current_code_version.id),
            template_id=template.id,
            source_code_id=current_code_version.source_code.id,
            source_code_version=current_code_version.source_code_version,
            variables=[
                VariableModel(
                    **{
                        "name": f"{template.template}_test_var",
                        "description": "Test variable",
                        "type": "array[string]",
                        "default": ["test"],
                    }
                ),
                VariableModel(
                    **{
                        "name": f"{template.template}_test_var_2",
                        "description": "Test variable 2",
                        "type": "boolean",
                        "default": False,
                    }
                ),
                VariableModel(
                    **{"name": f"{template.template}_test_var_3", "description": "Test variable 3", "type": "string"}
                ),
                VariableModel(
                    **{
                        "name": f"{template.template}_test_var_object",
                        "description": "Test variable object",
                        "type": "object",
                    }
                ),
                VariableModel(
                    **{
                        "name": f"{template.template}_test_var_number",
                        "description": "Test variable number",
                        "type": "number",
                        "default": 10,
                    }
                ),
                VariableModel(
                    **{"name": f"{template.template}_test_var_4", "description": "Test variable 4", "type": "string"}
                ),
                VariableModel(
                    **{"name": f"{template.template}_test_var_5", "description": "Test variable 5", "type": "string"}
                ),
            ],
            outputs=[
                OutputVariableModel(
                    **{
                        "name": f"{template.template}_test_output",
                        "description": "Test output",
                        "value": "${try(aws_default_vpc.this[0].arn, None)}",
                    }
                ),
                OutputVariableModel(
                    **{
                        "name": f"{template.template}_test_output_2",
                        "description": "Test output 2",
                        "value": "some_value",
                    }
                ),
                OutputVariableModel(
                    **{
                        "name": f"{template.template}_test_output_3",
                        "description": "Test output 3",
                        "value": "some_value_2",
                    }
                ),
                OutputVariableModel(
                    **{
                        "name": f"{template.template}_test_output_4",
                        "description": "Test output 3",
                        "value": "some_value_2",
                    }
                ),
            ],
        )
        updated = await source_code_version_service.update_variables(
            scv_with_variables,
            user,
        )
        await session.commit()
        await create_scv_config(session, updated)

    await change_state(
        session=session,
        entity=SourceCodeVersion,
        status=ModelStatus.DONE,
    )


async def create_scv_config(session: AsyncSession, scv: SourceCodeVersionResponse):
    source_code_version_service = get_source_code_version_service(session=session)

    configs: list[SourceConfigCreate] = []
    for idx, v in enumerate(scv.variables):
        configs.append(
            SourceConfigCreate(
                index=idx,
                source_code_version_id=scv.id,
                name=v.name,
                description=v.description,
                type=v.type,
                required=True,
                default=v.default,
                frozen=False,
                unique=False,
                options=[],
            )
        )
    _ = await source_code_version_service.create_configs(configs)
    await session.commit()
    outputs: list[SourceOutputConfigCreate] = []
    for idx, o in enumerate(scv.outputs):
        outputs.append(
            SourceOutputConfigCreate(
                index=idx,
                source_code_version_id=scv.id,
                name=o.name,
                description=o.description,
            )
        )
    _ = await source_code_version_service.create_output_configs(outputs)
    await session.commit()
