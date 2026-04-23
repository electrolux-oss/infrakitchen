from lorem import get_sentence, get_word
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.resources.dependencies import get_resource_service
from application.resources.model import Resource
from application.resources.schema import Outputs, ResourceCreate
from application.resources.crud import ResourceCRUD
from application.source_code_versions.dependencies import get_source_code_version_service
from application.storages.dependencies import get_storage_service
from application.templates.dependencies import get_template_service

from core.constants import ModelState, ModelStatus
from core.users.model import UserDTO

from application import (
    DependencyConfig,
    DependencyTag,
    Variables,
)
from application.integrations.model import Integration
from fixtures.logs import generate_logs
from fixtures.utils import change_state


async def insert_resources(session: AsyncSession, env: str, user: UserDTO):
    template_service = get_template_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)
    storage_service = get_storage_service(session=session)
    resource_crud = ResourceCRUD(session=session)

    resource_service = get_resource_service(session=session)

    query = select(Integration).where(
        Integration.integration_type == "cloud",
        Integration.name.ilike(f"%{env}%"),
    )
    result = await session.execute(query)
    integrations = result.scalars().all()

    templates = await template_service.get_all()
    source_code_versions = await source_code_version_service.get_all()

    for integration in integrations:
        previous_resource = None
        current_resource = None
        storage = await storage_service.get_all(filter={"integration_id": integration.id})

        for tpl in templates:
            scv = [sv for sv in source_code_versions if sv.template.id == tpl.id][0]
            source_code_version = await source_code_version_service.get_by_id_with_configs(str(scv.id))
            assert source_code_version is not None, "Source code version is none"

            name = get_word(count=3).replace(" ", "_")
            variables = []
            for v in source_code_version.variable_configs:
                if v.type == "string":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=f"test_{v.name}",
                            type=v.type,
                        )
                    )
                elif v.type == "boolean":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=True,
                            type=v.type,
                        )
                    )
                elif v.type == "number":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=10,
                            type=v.type,
                        )
                    )
                elif v.type == "object":
                    variables.append(
                        Variables(
                            name=v.name,
                            value={"key": "value"},
                            type=v.type,
                        )
                    )
                else:
                    variables.append(
                        Variables(
                            name=v.name,
                            value="test_value",
                            type=v.type,
                        )
                    )

            resource = ResourceCreate(
                template_id=tpl.id,
                source_code_version_id=source_code_version.id,
                name=name,
                description=get_sentence(),
                storage_id=storage[0].id if storage else None,
                storage_path=f"ik-catalog/{tpl.template}/{name}/terraform.tfstate",
                labels=[tpl.template, "resource", name],
                variables=variables,
                integration_ids=[integration.id],
                dependency_tags=[
                    DependencyTag(name=f"tag_{env}_{tpl.template}_key", value="value", inherited_by_children=True),
                    DependencyTag(name=f"tag_{env}_{tpl.template}_key2", value="value2"),
                ],
                dependency_config=[
                    DependencyConfig(name=f"{env}_{tpl.template}_key", value="value", inherited_by_children=True),
                    DependencyConfig(name=f"{env}_{tpl.template}_key2", value="value"),
                ],
            )
            if not previous_resource:
                current_resource = await resource_service.create(resource, user)
                await session.commit()
                previous_resource = current_resource
            else:
                assert previous_resource.id is not None, "Parent id is none"
                resource.parents = [previous_resource.id]
                current_resource = await resource_service.create(
                    resource,
                    user,
                    allowed_parent_states=[state.value for state in ModelState],
                )
                await session.commit()
                previous_resource = current_resource

            cur_res = await resource_crud.get_by_id(current_resource.id)
            assert cur_res is not None, "Resource is none"
            _ = await resource_crud.update(
                cur_res,
                {
                    "outputs": [
                        Outputs(
                            name=f"{o.name}",
                            value=f"value_{tpl.template}_{o.index}",
                        ).model_dump()
                        for o in source_code_version.output_configs
                    ],
                },
            )
            await session.commit()

            await generate_logs(
                session=session,
                entity_name="resource",
                entity_id=str(current_resource.id),
                user_id=str(user.id),
            )

    await change_state(
        session=session,
        entity=Resource,
        state=ModelState.PROVISIONED,
        status=ModelStatus.DONE,
    )
