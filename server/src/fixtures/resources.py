from typing import Any, cast
from lorem import get_sentence, get_word, random
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from application.projects.model import Project
from application.resources.dependencies import get_resource_service
from application.resources.model import Resource
from application.resources.schema import Outputs, ResourceCreate, ResourceResponse
from application.source_code_versions.dependencies import get_source_code_version_service
from application.storages.dependencies import get_storage_service
from application.templates.dependencies import get_template_service

from core.constants import ModelState, ModelStatus
from core.permissions.schema import EntityPolicyCreate
from core.users.model import UserDTO

from application import (
    DependencyConfig,
    DependencyTag,
    Variables,
)
from application.integrations.model import Integration
from fixtures.roles import create_role
from fixtures.projects import insert_projects
from fixtures.utils import change_state
from fixtures.workspaces import insert_workspaces


def _hex(length: int = 8) -> str:
    return "".join(random.choice("0123456789abcdef") for _ in range(length))


def generate_output_value(name: str, ctx: dict[str, Any]) -> Any:
    """Generate a realistic fake output value based on the resource inputs."""
    account = ctx.get("account", "123456789012")
    region = ctx.get("region", "eu-north-1")
    resource_name = ctx.get("name", "fixture")

    match name:
        case "env":
            return ctx.get("environment_name")
        case "cicd_admin_role_name":
            return "cicd-admin"
        case "cicd_admin_role_arn":
            return f"arn:aws:iam::{account}:role/cicd-admin"
        case "vpc_id":
            return ctx.get("vpc_id") or f"vpc-{_hex(17)}"
        case "private_subnets" | "public_subnets" | "database_subnets" | "elasticache_subnets":
            return [f"subnet-{_hex(17)}" for _ in range(3)]
        case "cidr":
            return ctx.get("cidr_block")
        case "vpc_owner_id":
            return account
        case "redis_primary_endpoint":
            return f"master.{resource_name}.{_hex(6)}.{region}.cache.amazonaws.com"
        case "reader_endpoint_address":
            return f"replica.{resource_name}.{_hex(6)}.{region}.cache.amazonaws.com"
        case "cluster_arn":
            return f"arn:aws:elasticache:{region}:{account}:replicationgroup:{resource_name}"
        case "replication_group_id":
            return resource_name
        case "iam_user_arn":
            return f"arn:aws:elasticache:{region}:{account}:user:{ctx.get('user_prefix', resource_name)}-iam"
        case "iam_user_read_only_arn":
            return f"arn:aws:elasticache:{region}:{account}:user:{ctx.get('user_prefix', resource_name)}-iam-ro"
        case "policy_name_effective":
            return ctx.get("policy_name")
        case "target_role":
            return ctx.get("aws_iam_role_name")
        case "policy_arn":
            return f"arn:aws:iam::{account}:policy/{ctx.get('policy_name', resource_name)}"
        case "deployment_id":
            return _hex(8)
        case "instance_names":
            prefix = f"{resource_name}-{ctx.get('environment', 'dev')}"
            return [f"{prefix}-{get_word(count=2).replace(' ', '-')}" for _ in range(int(ctx.get("instance_count", 2)))]
        case _:
            return ctx.get(name, f"{name}-{_hex()}")


async def set_resource_outputs(
    session: AsyncSession,
    resource_id: Any,
    output_names: list[str],
    variables: list[Variables],
    extra_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Store generated outputs on the resource, as if it had been applied."""
    ctx = {**(extra_context or {}), **{v.name: v.value for v in variables}}
    outputs = [Outputs(name=name, value=generate_output_value(name, ctx)) for name in output_names]
    _ = await session.execute(
        update(Resource).where(Resource.id == resource_id).values(outputs=[o.model_dump() for o in outputs])
    )
    return {o.name: o.value for o in outputs}


async def insert_regional_resources(
    session: AsyncSession,
    env: str,
    region: str,
    user: UserDTO,
    integration: Integration,
    parent: ResourceResponse | None = None,
    project: Project | None = None,
):
    default_values = {
        "name": get_word(count=3).replace(" ", "_"),
        "region": region,
        "environment_name": env,
        "account": str(random.randint(1000000000, 9999999999)),
        "cidr_block": f"10.{random.randint(0, 255)}.0.0/16",
        "vpc_id": f"vpc-{get_word(count=2).replace(' ', '')}",
    }

    resource_fixtures = [
        {
            "template": "service",
            "dependency_config": [
                DependencyConfig(name="service_name", value=f"test_service_{env}", inherited_by_children=True),
            ],
        },
        {
            "template": "aws_account",
            "dependency_tags": [
                DependencyTag(name="account", value="aws_account", inherited_by_children=True),
            ],
        },
        {
            "template": "aws_environment",
            "dependency_config": [
                DependencyConfig(name="environment_name", value=env, inherited_by_children=True),
                DependencyConfig(name="region", value=region, inherited_by_children=True),
            ],
        },
        {
            "template": "aws_vpc",
            "dependency_tags": [
                DependencyTag(name="vpc", value="aws_vpc", inherited_by_children=True),
            ],
        },
        {
            "template": "aws_redis",
        },
        {
            "template": "aws_redis_iam",
        },
    ]

    template_service = get_template_service(session=session)
    storage_service = get_storage_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)

    resource_service = get_resource_service(session=session)
    source_code_versions = await source_code_version_service.get_all()

    storage = await storage_service.get_all(filter={"integration_id": integration.id})

    created_resources: dict[str, ResourceResponse] = {}
    outputs_by_template: dict[str, dict[str, Any]] = {}
    if parent:
        created_resources[str(parent.template.id)] = parent

    for template_config in resource_fixtures:
        templates = await template_service.get_all(filter={"template": template_config["template"]})
        template = templates[0] if templates else None
        assert template is not None, f"Template {template_config['template']} not found"
        naming_convention = template.configuration.naming_convention or "{name}"
        source_code_version = None
        if template.abstract:
            resource = ResourceCreate(
                template_id=template.id,
                name=f"{template.template}-{env}-{get_word(count=2).replace(' ', '_')}",
                description=get_sentence(),
                dependency_tags=cast(list[DependencyTag], template_config.get("dependency_tags", [])),
                dependency_config=cast(list[DependencyConfig], template_config.get("dependency_config", [])),
                variables=[],
                project_id=project.id if project else None,
            )
        else:
            scv = [sv for sv in source_code_versions if sv.template.id == template.id][0]
            source_code_version = await source_code_version_service.get_by_id_with_configs(str(scv.id))
            assert source_code_version is not None, "Source code version is none"

            referenced_values = {
                ref.input_config_name: outputs_by_template.get(str(ref.reference_template_id), {}).get(
                    ref.output_config_name
                )
                for ref in source_code_version.template_refs
            }
            variables = []
            for v in source_code_version.variable_configs:
                value = referenced_values.get(v.name) or default_values.get(v.name, None) or v.default
                if v.type == "string":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=value if value else f"{get_word(count=3).replace(' ', '_')}_{env}",
                            type=v.type,
                        )
                    )
                elif v.type == "boolean":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=True if value is None else value,
                            type=v.type,
                        )
                    )
                elif v.type == "number":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=10 if value is None else value,
                            type=v.type,
                        )
                    )
                elif v.type == "object":
                    variables.append(
                        Variables(
                            name=v.name,
                            value={"key": "value"} if value is None else value,
                            type=v.type,
                        )
                    )
                else:
                    variables.append(
                        Variables(
                            name=v.name,
                            value=value if value else f"test_value_{v.name}",
                            type=v.type,
                        )
                    )

            resource = ResourceCreate(
                template_id=template.id,
                source_code_version_id=source_code_version.id,
                name=naming_convention,
                description=get_sentence(),
                integration_ids=[integration.id],
                storage_id=storage[0].id if storage else None,
                storage_path=f"ik-catalog/{template.template}/{env}/terraform.tfstate",
                dependency_tags=cast(list[DependencyTag], template_config.get("dependency_tags", [])),
                dependency_config=cast(list[DependencyConfig], template_config.get("dependency_config", [])),
                variables=variables,
                project_id=project.id if project else None,
            )

        allowed_parent_states = [state.value for state in ModelState]
        if template.parents:
            resource.parents = [
                created_resources[str(t_parent.id)].id
                for t_parent in template.parents
                if str(t_parent.id) in created_resources
            ]
            created_resource = await resource_service.create(
                resource, user, allowed_parent_states=allowed_parent_states
            )
        else:
            created_resource = await resource_service.create(resource, user)
        created_resources[str(resource.template_id)] = created_resource

        if source_code_version is not None:
            outputs_by_template[str(template.id)] = await set_resource_outputs(
                session,
                created_resource.id,
                [o.name for o in source_code_version.output_configs],
                resource.variables,
                extra_context=default_values,
            )
        await session.commit()


async def insert_organization_resource(session: AsyncSession, user: UserDTO) -> ResourceResponse:
    resource_service = get_resource_service(session=session)
    template_service = get_template_service(session=session)

    templates = await template_service.get_all(filter={"template": "organization"})
    template = templates[0] if templates else None
    assert template is not None, "Organization template not found"

    await create_role(session=session, role_name="organization_admin", user_ids=[user.id], requester=user)

    resource = ResourceCreate(
        template_id=template.id,
        name="myorganization",
        description=get_sentence(),
        dependency_tags=[
            DependencyTag(name="org", value="myorganization", inherited_by_children=True),
        ],
        dependency_config=[
            DependencyConfig(name="org_name", value="myorganization", inherited_by_children=True),
        ],
        variables=[],
    )

    result = await resource_service.create(resource, user)
    await change_state(
        session=session,
        entity=Resource,
        state=ModelState.PROVISIONED,
        status=ModelStatus.DONE,
    )
    resource_policy = EntityPolicyCreate(
        role="organization_admin",
        entity_id=result.id,
        entity_name="resource",
        action="admin",
        inherits_children=True,
    )
    _ = await resource_service.create_resource_policy(resource_policy, user)
    return result


async def insert_project_resource(
    session: AsyncSession, user: UserDTO, project_name: str, organization_resource: ResourceResponse
) -> ResourceResponse:
    resource_service = get_resource_service(session=session)
    template_service = get_template_service(session=session)

    templates = await template_service.get_all(filter={"template": "project"})
    template = templates[0] if templates else None
    assert template is not None, "Project template not found"

    await create_role(session=session, role_name=f"{project_name}_admin", user_ids=[user.id], requester=user)
    await create_role(session=session, role_name=f"{project_name}", user_ids=[user.id], requester=user)

    resource = ResourceCreate(
        template_id=template.id,
        name=project_name,
        description=get_sentence(),
        dependency_tags=[
            DependencyTag(name="project", value=project_name, inherited_by_children=True),
        ],
        dependency_config=[
            DependencyConfig(name="project_name", value=project_name, inherited_by_children=True),
        ],
        variables=[],
        parents=[organization_resource.id],
    )

    result = await resource_service.create(resource, user)
    await change_state(
        session=session,
        entity=Resource,
        state=ModelState.PROVISIONED,
        status=ModelStatus.DONE,
    )
    resource_policy = EntityPolicyCreate(
        role=f"{project_name}_admin",
        entity_id=result.id,
        entity_name="resource",
        action="admin",
    )
    _ = await resource_service.create_resource_policy(resource_policy, user)
    resource_policy = EntityPolicyCreate(
        role=f"{project_name}",
        entity_id=result.id,
        entity_name="resource",
        action="write",
    )
    _ = await resource_service.create_resource_policy(resource_policy, user)
    return result


async def insert_env_resources(
    session: AsyncSession, env: str, parent: ResourceResponse, project: Project, user: UserDTO
):
    query = select(Integration).where(
        Integration.integration_type == "cloud",
        Integration.integration_provider == "aws",
        Integration.name.ilike(f"%{env.capitalize()}%"),
    )
    result = await session.execute(query)
    integrations = result.scalars().all()
    regions = ["us-east-1", "ap-southeast-1", "eu-west-1"]

    for integration in integrations:
        for region in regions:
            await insert_regional_resources(session, env, region, user, integration, parent, project)

    await change_state(
        session=session,
        entity=Resource,
        state=ModelState.PROVISIONED,
        status=ModelStatus.DONE,
    )


async def insert_dummy_resources(
    session: AsyncSession, envs: list[str], parent: ResourceResponse, user: UserDTO
) -> list[ResourceResponse]:
    template_service = get_template_service(session=session)
    storage_service = get_storage_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)
    resource_service = get_resource_service(session=session)

    templates = await template_service.get_all(filter={"template": "dummy"})
    template = templates[0] if templates else None
    assert template is not None, "Dummy template not found"

    scv = next((sv for sv in await source_code_version_service.get_all() if sv.template.id == template.id), None)
    assert scv is not None, "Dummy source code version not found"
    scv_with_configs = await source_code_version_service.get_by_id_with_configs(str(scv.id))
    assert scv_with_configs is not None, "Dummy source code version not found"
    output_names = [o.name for o in scv_with_configs.output_configs]

    created_resources: list[ResourceResponse] = []
    for env in envs:
        storages = await storage_service.get_all(filter={"name": f"{env}_postgresql_storage"})
        assert storages, f"PostgreSQL storage not found for {env}"

        resource = ResourceCreate(
            template_id=template.id,
            source_code_version_id=scv.id,
            name=template.configuration.naming_convention or "{name}",
            description=get_sentence(),
            storage_id=storages[0].id,
            storage_path=f"ik-catalog/{template.template}/{env}/terraform.tfstate",
            variables=[
                Variables(name="name", value="dummy-app", type="string"),
                Variables(name="environment", value=env, type="string"),
                Variables(name="instance_count", value=2, type="number"),
                Variables(name="tags", value={"owner": "platform", "environment": env}, type="object"),
            ],
            parents=[parent.id],
        )
        created_resource = await resource_service.create(
            resource, user, allowed_parent_states=[state.value for state in ModelState]
        )
        _ = await set_resource_outputs(session, created_resource.id, output_names, resource.variables)
        await session.commit()
        created_resources.append(created_resource)

    return created_resources


async def insert_resources(session: AsyncSession, envs: list[str], user: UserDTO):
    organization_resource = await insert_organization_resource(session=session, user=user)
    await insert_dummy_resources(session=session, envs=envs, parent=organization_resource, user=user)
    for proj_postfix in "abcd":
        workspace = await insert_workspaces(session=session, env=f"workspace_{proj_postfix}", user=user)
        project = f"project_{proj_postfix}"
        proj = await insert_projects(session=session, env=project, workspace_id=workspace.id, user=user)
        for env in envs:
            await insert_env_resources(session=session, env=env, parent=organization_resource, project=proj, user=user)
