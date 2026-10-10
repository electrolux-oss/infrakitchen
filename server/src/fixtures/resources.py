from typing import Any, cast
import uuid

from lorem import get_sentence, get_word, random
from sqlalchemy import update
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
from fixtures.catalog import TEMPLATES
from fixtures.roles import create_role
from fixtures.projects import insert_projects
from fixtures.utils import change_state
from fixtures.workspaces import insert_workspaces


def _hex(length: int = 8) -> str:
    return "".join(random.choice("0123456789abcdef") for _ in range(length))


def _words(count: int, separator: str) -> str:
    return separator.join(get_word(count=count).lower().split())


def fake_outputs(template: str, ctx: dict[str, Any]) -> dict[str, Any]:
    """Outputs the dummy module of the template would produce for the inputs in ``ctx``."""
    account = ctx.get("account", "123456789012")
    region = ctx.get("region", "eu-north-1")
    name = ctx.get("name", "fixture")

    match template:
        case "dummy":
            prefix = f"{name}-{ctx.get('environment', 'dev')}"
            return {
                "deployment_id": _hex(8),
                "instance_names": [f"{prefix}-{_words(2, '-')}" for _ in range(int(ctx.get("instance_count", 2)))],
                "tags": ctx.get("tags", {}),
            }
        case "dummy_account":
            role_name = f"{ctx.get('environment_name', 'dev')}-cicd-admin"
            return {
                "account": account,
                "env": ctx.get("environment_name"),
                "cicd_admin_role_name": role_name,
                "cicd_admin_role_arn": f"arn:aws:iam::{account}:role/{role_name}",
            }
        case "dummy_vpc":
            subnets = {
                tier: [f"subnet-{_hex(16)}" for _ in range(2)]
                for tier in ("private", "public", "database", "elasticache")
            }
            return {
                "vpc_id": f"vpc-{_hex(16)}",
                **{f"{tier}_subnets": ids for tier, ids in subnets.items()},
                "cidr": ctx.get("cidr_block"),
                "vpc_owner_id": account,
            }
        case "dummy_redis":
            endpoint_id = _hex(6)
            user_arn = f"arn:aws:elasticache:{region}:{account}:user:{ctx.get('user_prefix')}"
            return {
                "redis_primary_endpoint": f"master.{name}.{endpoint_id}.{region}.cache.amazonaws.com",
                "reader_endpoint_address": f"replica.{name}.{endpoint_id}.{region}.cache.amazonaws.com",
                "cluster_arn": f"arn:aws:elasticache:{region}:{account}:replicationgroup:{name}",
                "replication_group_id": name,
                "iam_user_arn": f"{user_arn}-rw",
                "iam_user_read_only_arn": f"{user_arn}-ro",
                "user_prefix": ctx.get("user_prefix"),
            }
        case "dummy_redis_iam":
            policy_name = f"{ctx.get('policy_name')}-redis-iam"
            username = str(ctx.get("iam_user_arn", "")).rsplit("user:", 1)[-1]
            return {
                "policy_name_effective": policy_name,
                "target_role": ctx.get("aws_iam_role_name"),
                "policy_arn": f"arn:aws:iam::{account}:policy/{policy_name}",
                "redis_username": username,
                "redis_user_arn": ctx.get("iam_user_arn"),
                "connection_url": (
                    f"rediss://{username}@{ctx.get('redis_primary_endpoint')}:{ctx.get('redis_port', 6379)}"
                ),
            }
        case "dummy_eks":
            cluster_id = _hex(32).upper()
            oidc_issuer = f"oidc.eks.{region}.amazonaws.com/id/{cluster_id}"
            return {
                "cluster_name": name,
                "cluster_arn": f"arn:aws:eks:{region}:{account}:cluster/{name}",
                "cluster_endpoint": f"https://{cluster_id}.gr7.{region}.eks.amazonaws.com",
                "cluster_version": ctx.get("kubernetes_version"),
                "cluster_certificate_authority_data": f"LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t{_hex(32)}",
                "cluster_security_group_id": f"sg-{_hex(16)}",
                "cluster_role_arn": f"arn:aws:iam::{account}:role/{name}-eks-cluster",
                "oidc_issuer_url": f"https://{oidc_issuer}",
                "oidc_provider_arn": f"arn:aws:iam::{account}:oidc-provider/{oidc_issuer}",
                "node_group_name": f"{name}-default",
                "node_role_arn": f"arn:aws:iam::{account}:role/{name}-eks-node",
            }
        case "dummy_rds_postgres":
            address = f"{name}.{_hex(12)}.{region}.rds.amazonaws.com"
            version = str(ctx.get("engine_version", "17"))
            return {
                "db_instance_identifier": name,
                "db_instance_arn": f"arn:aws:rds:{region}:{account}:db:{name}",
                "db_instance_resource_id": f"db-{_hex(26).upper()}",
                "db_instance_address": address,
                "db_instance_port": 5432,
                "db_instance_endpoint": f"{address}:5432",
                "db_name": ctx.get("db_name"),
                "master_username": ctx.get("master_username"),
                "master_user_secret_arn": (
                    f"arn:aws:secretsmanager:{region}:{account}:secret:rds!db-{_hex(8)}-{_hex(6)}"
                ),
                "engine_version_actual": version if "." in version else f"{version}.1",
                "security_group_id": f"sg-{_hex(16)}",
            }
        case "dummy_eks_namespace":
            return {
                "namespace": ctx.get("namespace"),
                "namespace_uid": str(uuid.uuid4()),
                "cluster_name": ctx.get("cluster_name"),
                "resource_quota_name": f"{ctx.get('namespace')}-quota",
            }
        case "dummy_eks_service_account":
            role_name = f"{ctx.get('cluster_name')}-{ctx.get('namespace')}-{ctx.get('service_account_name')}"
            return {
                "iam_role_arn": f"arn:aws:iam::{account}:role/{role_name}",
                "iam_role_name": role_name,
                "service_account_name": ctx.get("service_account_name"),
                "namespace": ctx.get("namespace"),
            }
        case "dummy_rds_postgres_credentials":
            policy_name = f"{ctx.get('policy_name')}-rds-iam"
            username = ctx.get("db_username")
            return {
                "policy_name_effective": policy_name,
                "target_role": ctx.get("aws_iam_role_name"),
                "policy_arn": f"arn:aws:iam::{account}:policy/{policy_name}",
                "db_username": username,
                "db_user_arn": (
                    f"arn:aws:rds-db:{region}:{account}:dbuser:{ctx.get('db_instance_resource_id')}/{username}"
                ),
                "connection_url": (
                    f"postgresql://{username}@{ctx.get('db_instance_address')}:{ctx.get('db_instance_port', 5432)}"
                    f"/{ctx.get('db_name')}?sslmode=require"
                ),
            }
        case _:
            return {}


async def set_resource_outputs(
    session: AsyncSession,
    resource_id: Any,
    template: str,
    output_names: list[str],
    variables: list[Variables],
) -> dict[str, Any]:
    """Store generated outputs on the resource, as if it had been applied."""
    values = fake_outputs(template, {v.name: v.value for v in variables})
    outputs = [Outputs(name=name, value=values.get(name, f"{name}-{_hex()}")) for name in output_names]
    _ = await session.execute(
        update(Resource).where(Resource.id == resource_id).values(outputs=[o.model_dump() for o in outputs])
    )
    return {o.name: o.value for o in outputs}


def fixture_value(variable_type: str, value: Any, env: str) -> Any:
    """A value for a variable without a referenced, fixture or default value."""
    if value is not None:
        return value
    match variable_type:
        case "string":
            return f"{_words(3, '_')}_{env}"
        case "boolean":
            return True
        case "number":
            return 10
        case "object":
            return {"key": "value"}
        case _:
            return []


SERVICE_NAMES = ["checkout", "payments", "catalog", "orders", "notifications", "search", "billing", "inventory"]

# Dependency tags and configuration of the regional resources, inherited by their children
REGIONAL_DEPENDENCIES: dict[str, dict[str, Any]] = {
    "dummy_account": {
        "dependency_tags": [DependencyTag(name="account", value="dummy_account", inherited_by_children=True)],
    },
    "dummy_vpc": {
        "dependency_tags": [DependencyTag(name="vpc", value="dummy_vpc", inherited_by_children=True)],
    },
}

# Every catalog template below the organization, in creation order; the dummy one is created separately
REGIONAL_TEMPLATES = [t.key for t in TEMPLATES if t.key not in ("organization", "dummy")]


async def insert_regional_resources(
    session: AsyncSession,
    env: str,
    region: str,
    user: UserDTO,
    parent: ResourceResponse | None = None,
    project: Project | None = None,
):
    # Values for inputs that are neither referenced from a parent nor defaulted by the module
    fixture_values = {
        "name": _words(3, "_"),
        "region": region,
        "environment_name": env,
        "account": str(random.randint(1000000000, 9999999999)),
        "master_account_id": str(random.randint(1000000000, 9999999999)),
        "cidr_block": f"10.{random.randint(0, 255)}.0.0/16",
        "user_prefix": _words(2, "-"),
        "policy_name": _words(3, "_"),
        # Kubernetes names must be DNS labels, database users PostgreSQL identifiers;
        # the service account role name joins cluster, namespace and service account, at most 64 characters
        "namespace": f"ns-{_hex(6)}",
        "service_account_name": f"sa-{_hex(6)}",
        "db_username": f"app_{_words(2, '_')}",
    }
    dependencies: dict[str, dict[str, Any]] = {
        **REGIONAL_DEPENDENCIES,
        "service": {
            "dependency_config": [
                DependencyConfig(
                    name="service_name",
                    value=f"{random.choice(SERVICE_NAMES)}-{env}-{region}",
                    inherited_by_children=True,
                ),
            ],
        },
        "dummy_environment": {
            "dependency_config": [
                DependencyConfig(name="environment_name", value=env, inherited_by_children=True),
                DependencyConfig(name="region", value=region, inherited_by_children=True),
            ],
        },
    }

    template_service = get_template_service(session=session)
    storage_service = get_storage_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)

    resource_service = get_resource_service(session=session)
    source_code_versions = await source_code_version_service.get_all()

    storages = await storage_service.get_all(filter={"name": f"{env}_postgresql_storage"})
    assert storages, f"PostgreSQL storage not found for {env}"

    # Abstract resource names must be unique per template, so scope them to the project
    name_scope = project.name if project else _words(2, "_")
    created_resources: dict[str, ResourceResponse] = {}
    outputs_by_template: dict[str, dict[str, Any]] = {}
    if parent:
        created_resources[str(parent.template.id)] = parent

    for template_key in REGIONAL_TEMPLATES:
        templates = await template_service.get_all(filter={"template": template_key})
        template = templates[0] if templates else None
        assert template is not None, f"Template {template_key} not found"
        dependency_tags = cast(list[DependencyTag], dependencies.get(template_key, {}).get("dependency_tags", []))
        dependency_config = cast(
            list[DependencyConfig], dependencies.get(template_key, {}).get("dependency_config", [])
        )
        source_code_version = None
        if template.abstract:
            resource = ResourceCreate(
                template_id=template.id,
                name=f"{template.template}-{name_scope}-{env}-{region}",
                description=get_sentence(),
                dependency_tags=dependency_tags,
                dependency_config=dependency_config,
                variables=[],
                project_id=project.id if project else None,
            )
        else:
            scv = next(sv for sv in source_code_versions if sv.template.id == template.id)
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
                value = next(
                    (
                        candidate
                        for candidate in (referenced_values.get(v.name), fixture_values.get(v.name), v.default)
                        if candidate is not None
                    ),
                    None,
                )
                variables.append(Variables(name=v.name, value=fixture_value(v.type, value, env), type=v.type))

            resource = ResourceCreate(
                template_id=template.id,
                source_code_version_id=source_code_version.id,
                name=template.configuration.naming_convention or "{name}",
                description=get_sentence(),
                storage_id=storages[0].id,
                storage_path=(
                    f"ik-catalog/{project.name if project else 'default'}/{template.template}/{env}/{region}"
                    "/terraform.tfstate"
                ),
                dependency_tags=dependency_tags,
                dependency_config=dependency_config,
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
                template.template,
                [o.name for o in source_code_version.output_configs],
                resource.variables,
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
    regions = ["us-east-1", "ap-southeast-1", "eu-west-1"]

    for region in regions:
        await insert_regional_resources(session, env, region, user, parent, project)

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
        _ = await set_resource_outputs(
            session, created_resource.id, template.template, output_names, resource.variables
        )
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
