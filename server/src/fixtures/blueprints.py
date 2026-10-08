from typing import Literal, NotRequired, TypedDict
import uuid

from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from application.blueprints.dependencies import get_blueprint_service
from application.blueprints.schema import BlueprintConfiguration, BlueprintConstant, BlueprintCreate
from application.templates.dependencies import get_template_service
from application.workflows.schema import WiringRule
from core.users.model import UserDTO


class WiringFixture(TypedDict):
    source_template: str
    source_output: str
    target_template: str
    target_variable: str


class ConstantFixture(TypedDict):
    name: str
    type: NotRequired[Literal["string", "number"]]


class ConstantWiringFixture(TypedDict):
    constant: str
    target_template: str
    target_variable: str


class BlueprintFixture(TypedDict):
    name: str
    description: str
    templates: list[str]
    external_templates: NotRequired[list[str]]
    wiring: NotRequired[list[WiringFixture]]
    constants: NotRequired[list[ConstantFixture]]
    constant_wiring: NotRequired[list[ConstantWiringFixture]]
    labels: list[str]


blueprint_fixtures: list[BlueprintFixture] = [
    {
        "name": "AWS VPC with Redis",
        "description": get_sentence(),
        "templates": ["aws_vpc", "aws_redis", "aws_redis_iam"],
        # Parents that are not part of the blueprint are pinned as external inputs:
        # aws_vpc -> aws_environment, aws_redis_iam -> service
        "external_templates": ["aws_environment", "service"],
        "wiring": [
            {
                "source_template": "aws_vpc",
                "source_output": "vpc_id",
                "target_template": "aws_redis",
                "target_variable": "vpc_id",
            },
            {
                "source_template": "aws_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "aws_redis",
                "target_variable": "account",
            },
            {
                "source_template": "aws_vpc",
                "source_output": "vpc_owner_id",
                "target_template": "aws_redis_iam",
                "target_variable": "account",
            },
            {
                "source_template": "aws_redis",
                "source_output": "cluster_arn",
                "target_template": "aws_redis_iam",
                "target_variable": "cluster_arn",
            },
            {
                "source_template": "aws_redis",
                "source_output": "iam_user_arn",
                "target_template": "aws_redis_iam",
                "target_variable": "iam_user_arn",
            },
            {
                "source_template": "aws_redis",
                "source_output": "user_prefix",
                "target_template": "aws_redis_iam",
                "target_variable": "aws_iam_role_name",
            },
        ],
        "constants": [{"name": "name", "type": "string"}],
        "constant_wiring": [
            {"constant": "name", "target_template": "aws_vpc", "target_variable": "name"},
            {"constant": "name", "target_template": "aws_redis", "target_variable": "name"},
        ],
        "labels": ["aws", "vpc", "redis", "iam_credentials"],
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
                    )
                    for cw in fixture.get("constant_wiring", [])
                ],
            ),
            labels=fixture["labels"],
        )
        _ = await blueprint_service.create_blueprint(blueprint, user)
        await session.commit()
