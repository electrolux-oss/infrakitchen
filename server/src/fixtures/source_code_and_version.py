from typing import Any, NotRequired, TypedDict

from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.schema import (
    SourceCodeVersionCreate,
    SourceConfigCreate,
    SourceConfigUpdateWithId,
    SourceOutputConfigCreate,
)
from application.source_codes.dependencies import get_source_code_service
from application.templates.dependencies import get_template_service

from application.source_code_versions.model import SourceCodeVersion
from core.constants import ModelStatus
from core.users.model import UserDTO

from application import (
    OutputVariableModel,
)
from fixtures.utils import change_state


class TemplateReferenceFixture(TypedDict):
    """Template reference linking an input config to an output from another template."""

    input_config_name: str
    reference_template: str
    output_config_name: str


class SCVFixture(TypedDict):
    """Source Code Version fixture with variables, outputs, and template references."""

    variables: list[dict[str, Any]]
    outputs: list[dict[str, Any]]
    template_references: NotRequired[list[TemplateReferenceFixture]]


scv_fixtures: dict[str, SCVFixture] = {
    "aws-account": {
        "variables": [
            {
                "name": "region",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": "eu-north-1",
                "description": "AWS region",
                "sensitive": False,
                "frozen": True,
                "options": ["eu-north-1", "eu-west-1", "us-east-1", "ap-southeast-1"],
            },
            {
                "name": "account",
                "type": "string",
                "original_type": "string",
                "required": True,
                "unique": True,
                "default": None,
                "description": "Target AWS account ID",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "master_account_id",
                "type": "string",
                "original_type": "string",
                "required": False,
                "default": None,
                "description": "Account ID that will assume the role in this account",
                "sensitive": False,
            },
            {
                "name": "environment_name",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": "dev",
                "description": "Environment label",
                "sensitive": False,
                "frozen": True,
                "options": ["dev", "staging", "prod"],
            },
            {
                "name": "tags",
                "type": "object",
                "original_type": "map(any)",
                "required": False,
                "default": {},
                "description": "Tags applied to created resources",
                "sensitive": False,
            },
            {
                "name": "max_session_duration",
                "type": "number",
                "original_type": "number",
                "required": False,
                "default": 10800,
                "description": "Max IAM role session duration in seconds",
                "sensitive": False,
                "restricted": True,
            },
        ],
        "outputs": [
            {
                "name": "account",
                "value": "${data.aws_caller_identity.current.account_id}",
                "description": "AWS account ID",
            },
            {"name": "env", "value": "${var.environment_name}", "description": "Environment name"},
            {
                "name": "cicd_admin_role_name",
                "value": "${aws_iam_role.cicd_admin.name}",
                "description": "Created CI/CD admin IAM role name",
            },
            {
                "name": "cicd_admin_role_arn",
                "value": "${aws_iam_role.cicd_admin.arn}",
                "description": "Created CI/CD admin IAM role ARN",
            },
        ],
    },
    "aws-vpc": {
        "variables": [
            {
                "name": "account",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "Target AWS account ID",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "region",
                "type": "string",
                "original_type": "string",
                "required": False,
                "default": "eu-north-1",
                "description": "AWS region",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "name",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "VPC name",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "cidr_block",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "VPC CIDR base (for example 10.20.0.0/16)",
                "sensitive": False,
                "frozen": True,
                "unique": False,
            },
            {
                "name": "secondary_cidr_blocks",
                "type": "array[string]",
                "original_type": "list(string)",
                "required": False,
                "default": [],
                "description": "Optional secondary CIDR blocks",
                "sensitive": False,
            },
            {
                "name": "tags",
                "type": "object",
                "original_type": "map(any)",
                "required": False,
                "default": {},
                "description": "Tags applied to created resources",
                "sensitive": False,
            },
        ],
        "outputs": [
            {"name": "vpc_id", "value": "${aws_vpc.this.id}", "description": "The ID of the VPC"},
            {
                "name": "private_subnets",
                "value": "${[for subnet in aws_subnet.private : subnet.id]}",
                "description": "List of private subnet IDs",
            },
            {
                "name": "public_subnets",
                "value": "${[for subnet in aws_subnet.public : subnet.id]}",
                "description": "List of public subnet IDs",
            },
            {
                "name": "database_subnets",
                "value": "${[for subnet in aws_subnet.database : subnet.id]}",
                "description": "List of database subnet IDs",
            },
            {
                "name": "elasticache_subnets",
                "value": "${[for subnet in aws_subnet.elasticache : subnet.id]}",
                "description": "List of elasticache subnet IDs",
            },
            {"name": "cidr", "value": "${aws_vpc.this.cidr_block}", "description": "CIDR block used by the VPC"},
            {
                "name": "vpc_owner_id",
                "value": "${aws_vpc.this.owner_id}",
                "description": "AWS account ID owning the VPC",
            },
        ],
        "template_references": [
            {
                "input_config_name": "account",
                "reference_template": "aws-account",
                "output_config_name": "account",
            }
        ],
    },
    "aws-redis": {
        "variables": [
            {
                "name": "account",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "Target AWS account ID",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "region",
                "type": "string",
                "original_type": "string",
                "required": False,
                "default": "eu-north-1",
                "description": "AWS region",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "name",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "Redis replication group name",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "redis_version",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": "8.2",
                "description": "Valkey/Redis engine version",
                "sensitive": False,
                "options": ["8.0", "8.1", "8.2"],
            },
            {
                "name": "node_type",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": "cache.t4g.small",
                "description": "Redis node type",
                "sensitive": False,
                "options": [
                    "cache.t4g.small",
                    "cache.t4g.medium",
                    "cache.t4g.large",
                    "cache.m6g.large",
                    "cache.m6g.xlarge",
                    "cache.m6g.2xlarge",
                ],
            },
            {
                "name": "vpc_id",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "VPC ID for subnet and security-group discovery",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "ingress_cidrs",
                "type": "array[string]",
                "original_type": "list(string)",
                "required": False,
                "default": [],
                "description": "CIDR blocks allowed to connect",
                "sensitive": False,
            },
            {
                "name": "number_of_nodes",
                "type": "number",
                "original_type": "number",
                "required": True,
                "default": 2,
                "description": "Number of cache nodes",
                "sensitive": False,
            },
            {
                "name": "tags",
                "type": "object",
                "original_type": "map(string)",
                "required": False,
                "default": {},
                "description": "Tags applied to created resources",
                "sensitive": False,
            },
            {
                "name": "family",
                "type": "string",
                "original_type": "string",
                "required": False,
                "default": "valkey8",
                "description": "Redis/Valkey parameter group family",
                "sensitive": False,
                "restricted": True,
            },
            {
                "name": "default_user_access_string",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": "off -@all",
                "description": "Default user access string",
                "sensitive": False,
            },
            {
                "name": "user_prefix",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "Prefix for generated IAM Redis users",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "parameters",
                "type": "object",
                "original_type": "object({\n  parameters = optional(list(any), [])\n})",
                "required": False,
                "default": {"parameters": []},
                "description": "Redis parameter list wrapper",
                "sensitive": False,
            },
        ],
        "outputs": [
            {
                "name": "redis_primary_endpoint",
                "value": "${aws_elasticache_replication_group.redis.primary_endpoint_address}",
                "description": "Primary Redis endpoint",
            },
            {
                "name": "reader_endpoint_address",
                "value": "${aws_elasticache_replication_group.redis.reader_endpoint_address}",
                "description": "Reader endpoint",
            },
            {
                "name": "cluster_arn",
                "value": "${aws_elasticache_replication_group.redis.arn}",
                "description": "ElastiCache cluster ARN",
            },
            {
                "name": "replication_group_id",
                "value": "${aws_elasticache_replication_group.redis.replication_group_id}",
                "description": "Replication group ID",
            },
            {
                "name": "iam_user_arn",
                "value": "${aws_elasticache_user.rw.arn}",
                "description": "Generated IAM user ARN",
            },
            {
                "name": "iam_user_read_only_arn",
                "value": "${aws_elasticache_user.ro.arn}",
                "description": "Generated read-only IAM user ARN",
            },
            {
                "name": "user_prefix",
                "value": "${var.user_prefix}",
                "description": "User prefix used by Redis module",
            },
        ],
        "template_references": [
            {
                "input_config_name": "account",
                "reference_template": "aws-account",
                "output_config_name": "account",
            },
            {
                "input_config_name": "vpc_id",
                "reference_template": "aws-vpc",
                "output_config_name": "vpc_id",
            },
        ],
    },
    "aws-redis-iam": {
        "variables": [
            {
                "name": "cluster_arn",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "ElastiCache cluster ARN from the Redis module",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "iam_user_arn",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "Redis IAM user ARN from the Redis module",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "aws_iam_role_name",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "Application IAM role name that needs Redis connect permission",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "account",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "Target AWS account ID",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "region",
                "type": "string",
                "original_type": "string",
                "required": False,
                "default": "eu-north-1",
                "description": "AWS region",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "policy_name",
                "type": "string",
                "original_type": "string",
                "required": True,
                "default": None,
                "description": "Policy name prefix",
                "sensitive": False,
                "frozen": True,
            },
            {
                "name": "tags",
                "type": "object",
                "original_type": "map(any)",
                "required": False,
                "default": {},
                "description": "Tags applied to created resources",
                "sensitive": False,
            },
        ],
        "outputs": [
            {
                "name": "policy_name_effective",
                "value": "${aws_iam_policy.redis_iam.name}",
                "description": "IAM inline policy name created on the role",
            },
            {
                "name": "target_role",
                "value": "${var.aws_iam_role_name}",
                "description": "Role that receives Redis IAM permissions",
            },
            {
                "name": "policy_arn",
                "value": "${aws_iam_policy.redis_iam.arn}",
                "description": "IAM policy ARN attached to the role",
            },
        ],
        "template_references": [
            {
                "input_config_name": "account",
                "reference_template": "aws-account",
                "output_config_name": "account",
            },
            {
                "input_config_name": "cluster_arn",
                "reference_template": "aws-redis",
                "output_config_name": "cluster_arn",
            },
            {
                "input_config_name": "iam_user_arn",
                "reference_template": "aws-redis",
                "output_config_name": "iam_user_arn",
            },
            {
                "input_config_name": "aws_iam_role_name",
                "reference_template": "aws-redis",
                "output_config_name": "user_prefix",
            },
        ],
    },
}


async def generate_configs_and_outputs(
    session: AsyncSession,
    source_code_version_instance: SourceCodeVersion,
    variables: list[dict[str, Any]],
    outputs: list[OutputVariableModel],
):
    """Generate configs and outputs for the source code version"""
    source_code_version_service = get_source_code_version_service(session=session)

    configs: list[SourceConfigCreate] = []
    for idx, v in enumerate(variables):
        config = SourceConfigCreate(
            index=idx,
            source_code_version_id=source_code_version_instance.id,
            name=v["name"],
            description=v.get("description", ""),
            type=v["type"],
            required=v.get("required", False),
            default=v.get("default"),
            sensitive=v.get("sensitive", False),
            frozen=v.get("frozen", False),
            restricted=v.get("restricted", False),
            unique=v.get("unique", False),
            options=v.get("options", []),
        )
        configs.append(config)
    _ = await source_code_version_service.create_configs(configs)

    foroutputs: list[SourceOutputConfigCreate] = []
    for idx, o in enumerate(outputs):
        output = SourceOutputConfigCreate(
            index=idx,
            source_code_version_id=source_code_version_instance.id,
            name=o.name,
            description=o.description,
        )
        foroutputs.append(output)
    _ = await source_code_version_service.create_output_configs(foroutputs)


async def insert_source_code_version(session: AsyncSession, user: UserDTO):
    template_service = get_template_service(session=session)
    source_code_service = get_source_code_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)

    # insert version
    source_code_list = await source_code_service.get_all()
    source_code = source_code_list[0]
    source_code_folder_refs = {}
    for folder in source_code.git_folders_map:
        source_code_folder_refs[folder.ref] = folder.folders

    source_code_version_list = await source_code_version_service.get_all()

    templates = await template_service.get_all()
    templates_by_name = {t.template.replace("_", "-"): t for t in templates}

    for template in templates:
        if template.id in [version.template.id for version in source_code_version_list]:
            continue

        template_name = template.template.replace("_", "-")

        tag = next((tag for tag in source_code.git_tags if tag == f"{template_name}-v1.0"), None)
        if not tag:
            continue

        folder_name = next(
            (folder for folder in source_code_folder_refs.get(tag, []) if folder.endswith(f"{template_name}/")),
            None,
        )
        if not folder_name:
            raise Exception(
                f"No folder found for template {template.template} in source code {source_code.source_code_url}"
            )

        version = SourceCodeVersionCreate(
            template_id=template.id,
            source_code_id=source_code.id,
            source_code_version=tag,
            source_code_folder=folder_name,
            description=get_sentence(),
        )
        current_code_version = await source_code_version_service.create(version, user)
        await session.commit()
        scv_from_db = await source_code_version_service.crud.get_by_id(current_code_version.id)
        assert scv_from_db is not None
        scv_from_db.variables = scv_fixtures.get(template_name, {}).get("variables", [])
        scv_from_db.outputs = scv_fixtures.get(template_name, {}).get("outputs", [])
        await generate_configs_and_outputs(
            session=session,
            source_code_version_instance=scv_from_db,
            variables=scv_fixtures.get(template_name, {}).get("variables", []),
            outputs=[OutputVariableModel(**o) for o in scv_from_db.outputs],
        )
        await session.commit()

        # Apply template references if they exist in the fixture
        fixture = scv_fixtures.get(template_name, {})
        template_references = fixture.get("template_references", [])
        if template_references:
            # Get all configs for this source code version to build update requests
            configs = await source_code_version_service.get_configs_by_scv_id(current_code_version.id)
            config_updates: list[SourceConfigUpdateWithId] = []

            for config in configs:
                config_ref = next(
                    (ref for ref in template_references if ref["input_config_name"] == config.name),
                    None,
                )
                if config_ref:
                    reference_template = templates_by_name.get(config_ref["reference_template"])
                    if not reference_template:
                        raise ValueError(
                            f"Reference template '{config_ref['reference_template']}' not found for "
                            f"config '{config.name}' in template '{template_name}'"
                        )
                    config_update = SourceConfigUpdateWithId(
                        id=config.id,
                        reference_template_id=reference_template.id,
                        output_config_name=config_ref["output_config_name"],
                        template_id=template.id,
                    )
                    config_updates.append(config_update)

            if config_updates:
                await source_code_version_service.update_configs(current_code_version.id, config_updates)
                await session.commit()

    await change_state(
        session=session,
        entity=SourceCodeVersion,
        status=ModelStatus.DONE,
    )
