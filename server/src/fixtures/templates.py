from typing import NotRequired, TypedDict
from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from application.templates.dependencies import get_template_service
from application.templates.schema import TemplateConfig, TemplateCreate
from core.users.model import UserDTO


class TemplateFixture(TypedDict):
    name: str
    description: str
    template: str
    abstract: NotRequired[bool]
    labels: list[str]
    configuration: TemplateConfig
    parent: NotRequired[list[str]]


template_fixtures: list[TemplateFixture] = [
    {
        "name": "Organization",
        "description": get_sentence(),
        "template": "organization",
        "labels": ["organization", "cloud"],
        "configuration": TemplateConfig(),
        "abstract": True,
    },
    {
        "name": "Service",
        "description": get_sentence(),
        "template": "service",
        "labels": ["service", "cloud"],
        "configuration": TemplateConfig(),
        "abstract": True,
        "parent": ["organization"],
    },
    {
        "name": "AWS Account",
        "description": get_sentence(),
        "template": "aws_account",
        "labels": ["aws", "account", "cloud"],
        "configuration": TemplateConfig(
            allowed_provider_integration_types=["aws"],
            naming_convention="aws-account-{environment_name}-{account}",
        ),
        "parent": ["organization"],
    },
    {
        "name": "AWS Environment",
        "description": get_sentence(),
        "template": "aws_environment",
        "labels": ["aws", "environment", "cloud"],
        "configuration": TemplateConfig(
            naming_convention="aws-environment-{env}-{region}",
        ),
        "abstract": True,
        "parent": ["aws_account"],
    },
    {
        "name": "AWS VPC",
        "description": get_sentence(),
        "template": "aws_vpc",
        "labels": ["aws", "vpc", "cloud"],
        "configuration": TemplateConfig(
            allowed_provider_integration_types=["aws"],
            naming_convention="aws-vpc-{environment_name}-{region}-{name}",
        ),
        "parent": ["aws_environment"],
    },
    {
        "name": "AWS Redis",
        "description": get_sentence(),
        "template": "aws_redis",
        "labels": ["aws", "redis", "cloud"],
        "configuration": TemplateConfig(
            allowed_provider_integration_types=["aws"],
            naming_convention="aws-redis-{environment_name}-{region}-{name}",
        ),
        "parent": ["aws_vpc"],
    },
    {
        "name": "AWS Redis IAM Credentials",
        "description": get_sentence(),
        "template": "aws_redis_iam",
        "labels": ["aws", "redis", "iam_credentials", "cloud"],
        "configuration": TemplateConfig(
            allowed_provider_integration_types=["aws"],
            naming_convention="aws-redis-iam-credentials-{environment_name}-{region}-{policy_name}",
        ),
        "parent": ["aws_redis", "service"],
    },
]


async def insert_templates(session: AsyncSession, user: UserDTO):
    template_service = get_template_service(session=session)
    templates_by_key = {}

    for template in template_fixtures:
        template_body = TemplateCreate.model_validate(template)

        existant_template = await template_service.get_all(filter={"name": template["name"]})
        if existant_template:
            templates_by_key[template["template"]] = existant_template[0]
            continue

        parent_ids = []
        for parent_key in template.get("parent", []):
            parent_template = templates_by_key.get(parent_key)
            if parent_template is None:
                existing_parent = await template_service.get_all(filter={"template": parent_key})
                if not existing_parent:
                    raise ValueError(f"Parent template '{parent_key}' not found for template '{template['template']}'")
                parent_template = existing_parent[0]
                templates_by_key[parent_key] = parent_template

            assert parent_template.id is not None
            parent_ids.append(parent_template.id)

        template_body.parents = parent_ids
        current_template = await template_service.create_template(template_body, user)
        await session.commit()
        templates_by_key[template["template"]] = current_template

    await session.commit()
