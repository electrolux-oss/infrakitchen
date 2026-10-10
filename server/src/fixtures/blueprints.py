from typing import Literal, NotRequired, TypedDict
import uuid

from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from application.blueprints.dependencies import get_blueprint_service
from application.blueprints.schema import BlueprintConfiguration, BlueprintConstant, BlueprintCreate
from application.templates.dependencies import get_template_service
from application.workflows.schema import WiringRule
from core.users.model import UserDTO
from fixtures.catalog import TEMPLATES_BY_KEY


class WiringFixture(TypedDict):
    source_template: str
    source_output: str
    target_template: str
    target_variable: str
    source_type: NotRequired[Literal["output", "dependency_config"]]
    target_type: NotRequired[Literal["variable", "dependency_config"]]


class ConstantFixture(TypedDict):
    name: str
    type: NotRequired[Literal["string", "number"]]


class ConstantWiringFixture(TypedDict):
    constant: str
    target_template: str
    target_variable: str
    target_type: NotRequired[Literal["variable", "dependency_config"]]


class BlueprintFixture(TypedDict):
    name: str
    description: str
    templates: list[str]
    external_templates: NotRequired[list[str]]
    wiring: NotRequired[list[WiringFixture]]
    constants: NotRequired[list[ConstantFixture]]
    constant_wiring: NotRequired[list[ConstantWiringFixture]]
    labels: list[str]


def config_wires(source_template: str, target_templates: list[str]) -> list[WiringFixture]:
    """Wire each required dependency config of the source to the same named input of the targets."""
    source = TEMPLATES_BY_KEY[source_template]
    return [
        {
            "source_template": source_template,
            "source_output": config,
            "source_type": "dependency_config",
            "target_template": target,
            "target_variable": config,
        }
        for config in source.required_configuration_variables
        for target in target_templates
        if config in {v.name for v in TEMPLATES_BY_KEY[target].variables}
    ]


# vpc -> eks, rds and redis; eks -> namespace -> service account -> credentials for rds and redis;
# the abstract service names the service account through its required dependency config
PLATFORM_TEMPLATES = [
    "service",
    "dummy_vpc",
    "dummy_eks",
    "dummy_rds_postgres",
    "dummy_redis",
    "dummy_eks_namespace",
    "dummy_eks_service_account",
    "dummy_redis_iam",
    "dummy_rds_postgres_credentials",
]


blueprint_fixtures: list[BlueprintFixture] = [
    {
        "name": "Dummy Service Platform",
        "description": get_sentence(),
        "templates": PLATFORM_TEMPLATES,
        # Parents that are not part of the blueprint are pinned as external inputs:
        # dummy_vpc -> dummy_environment, service -> organization
        "external_templates": ["dummy_environment", "organization"],
        "wiring": [
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_id",
                "target_template": "dummy_eks",
                "target_variable": "vpc_id",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "dummy_eks",
                "target_variable": "account",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_id",
                "target_template": "dummy_rds_postgres",
                "target_variable": "vpc_id",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "dummy_rds_postgres",
                "target_variable": "account",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_id",
                "target_template": "dummy_redis",
                "target_variable": "vpc_id",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "dummy_redis",
                "target_variable": "account",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "dummy_eks_namespace",
                "target_variable": "account",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "dummy_eks_service_account",
                "target_variable": "account",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "dummy_redis_iam",
                "target_variable": "account",
            },
            {
                "source_template": "dummy_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "dummy_rds_postgres_credentials",
                "target_variable": "account",
            },
            {
                "source_template": "dummy_eks",
                "source_output": "cluster_name",
                "target_template": "dummy_eks_namespace",
                "target_variable": "cluster_name",
            },
            {
                "source_template": "dummy_eks_namespace",
                "source_output": "cluster_name",
                "target_template": "dummy_eks_service_account",
                "target_variable": "cluster_name",
            },
            {
                "source_template": "dummy_eks_namespace",
                "source_output": "namespace",
                "target_template": "dummy_eks_service_account",
                "target_variable": "namespace",
            },
            {
                "source_template": "dummy_eks",
                "source_output": "oidc_provider_arn",
                "target_template": "dummy_eks_service_account",
                "target_variable": "oidc_provider_arn",
            },
            {
                "source_template": "dummy_eks",
                "source_output": "oidc_issuer_url",
                "target_template": "dummy_eks_service_account",
                "target_variable": "oidc_issuer_url",
            },
            {
                "source_template": "dummy_redis",
                "source_output": "cluster_arn",
                "target_template": "dummy_redis_iam",
                "target_variable": "cluster_arn",
            },
            {
                "source_template": "dummy_redis",
                "source_output": "iam_user_arn",
                "target_template": "dummy_redis_iam",
                "target_variable": "iam_user_arn",
            },
            {
                "source_template": "dummy_redis",
                "source_output": "redis_primary_endpoint",
                "target_template": "dummy_redis_iam",
                "target_variable": "redis_primary_endpoint",
            },
            {
                "source_template": "service",
                "source_output": "service_name",
                "source_type": "dependency_config",
                "target_template": "dummy_eks_service_account",
                "target_variable": "service_account_name",
            },
            {
                "source_template": "dummy_eks_service_account",
                "source_output": "iam_role_name",
                "target_template": "dummy_redis_iam",
                "target_variable": "aws_iam_role_name",
            },
            {
                "source_template": "dummy_rds_postgres",
                "source_output": "db_instance_resource_id",
                "target_template": "dummy_rds_postgres_credentials",
                "target_variable": "db_instance_resource_id",
            },
            {
                "source_template": "dummy_rds_postgres",
                "source_output": "db_instance_address",
                "target_template": "dummy_rds_postgres_credentials",
                "target_variable": "db_instance_address",
            },
            {
                "source_template": "dummy_rds_postgres",
                "source_output": "db_instance_port",
                "target_template": "dummy_rds_postgres_credentials",
                "target_variable": "db_instance_port",
            },
            {
                "source_template": "dummy_rds_postgres",
                "source_output": "db_name",
                "target_template": "dummy_rds_postgres_credentials",
                "target_variable": "db_name",
            },
            {
                "source_template": "dummy_eks_service_account",
                "source_output": "iam_role_name",
                "target_template": "dummy_rds_postgres_credentials",
                "target_variable": "aws_iam_role_name",
            },
            # the region of the selected environment goes to every template with a region input
            *config_wires("dummy_environment", PLATFORM_TEMPLATES),
        ],
        "constants": [
            {"name": "name", "type": "string"},
            {"name": "user_prefix", "type": "string"},
            {"name": "namespace", "type": "string"},
            {"name": "service_name", "type": "string"},
            {"name": "policy_name", "type": "string"},
            {"name": "db_username", "type": "string"},
        ],
        "constant_wiring": [
            {"constant": "name", "target_template": "dummy_vpc", "target_variable": "name"},
            {"constant": "name", "target_template": "dummy_eks", "target_variable": "name"},
            {"constant": "name", "target_template": "dummy_rds_postgres", "target_variable": "name"},
            {"constant": "name", "target_template": "dummy_redis", "target_variable": "name"},
            {"constant": "user_prefix", "target_template": "dummy_redis", "target_variable": "user_prefix"},
            {"constant": "namespace", "target_template": "dummy_eks_namespace", "target_variable": "namespace"},
            {
                "constant": "service_name",
                "target_template": "service",
                "target_variable": "service_name",
                "target_type": "dependency_config",
            },
            {"constant": "policy_name", "target_template": "dummy_redis_iam", "target_variable": "policy_name"},
            {
                "constant": "policy_name",
                "target_template": "dummy_rds_postgres_credentials",
                "target_variable": "policy_name",
            },
            {
                "constant": "db_username",
                "target_template": "dummy_rds_postgres_credentials",
                "target_variable": "db_username",
            },
        ],
        "labels": ["dummy", "vpc", "eks", "rds", "redis", "service_account", "iam_credentials"],
    },
]


async def insert_blueprints(session: AsyncSession, user: UserDTO):
    blueprint_service = get_blueprint_service(session=session)
    template_service = get_template_service(session=session)

    templates_by_key = {t.template: t for t in await template_service.get_all()}

    def template_id(key: str):
        template = templates_by_key.get(key)
        if template is None:
            raise ValueError(f"Template '{key}' not found for blueprint fixtures")
        return template.id

    for fixture in blueprint_fixtures:
        if await blueprint_service.get_all(filter={"name": fixture["name"]}):
            continue

        constants = {
            c["name"]: BlueprintConstant(id=uuid.uuid4(), name=c["name"], type=c.get("type", "string"))
            for c in fixture.get("constants", [])
        }

        blueprint = BlueprintCreate(
            name=fixture["name"],
            description=fixture["description"],
            template_ids=[template_id(t) for t in fixture["templates"]],
            external_template_ids=[template_id(t) for t in fixture.get("external_templates", [])],
            wiring=[
                WiringRule(
                    source_template_id=template_id(w["source_template"]),
                    source_output=w["source_output"],
                    target_template_id=template_id(w["target_template"]),
                    target_variable=w["target_variable"],
                    source_type=w.get("source_type", "output"),
                    target_type=w.get("target_type", "variable"),
                )
                for w in fixture.get("wiring", [])
            ],
            configuration=BlueprintConfiguration(
                constants=list(constants.values()),
                constant_wires=[
                    # Constant wires use the constant id as source template and its name as output
                    WiringRule(
                        source_template_id=constants[cw["constant"]].id,
                        source_output=cw["constant"],
                        target_template_id=template_id(cw["target_template"]),
                        target_variable=cw["target_variable"],
                        target_type=cw.get("target_type", "variable"),
                    )
                    for cw in fixture.get("constant_wiring", [])
                ],
            ),
            labels=fixture["labels"],
        )
        _ = await blueprint_service.create_blueprint(blueprint, user)
        await session.commit()
