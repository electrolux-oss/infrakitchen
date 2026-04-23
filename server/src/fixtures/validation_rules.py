from sqlalchemy.ext.asyncio import AsyncSession


from core.users.model import UserDTO

from application.validation_rules.crud import ValidationRuleCRUD
from application.validation_rules.model import ValidationRuleTargetType
from application.validation_rules.schema import ValidationRuleBase
from application.validation_rules.service import ValidationRuleService


async def insert_validation_rules(session: AsyncSession, user: UserDTO):
    validation_rule_service = ValidationRuleService(crud=ValidationRuleCRUD(session=session))
    predefined_rules = [
        {
            "description": (
                "string of 2-4 parts separated by hyphens, consisting of lowercase letters, "
                "the last part consisting of digits"
            ),
            "regex_pattern": r"^[a-z]+(?:-[a-z]+){0,2}-\d+$",
        },
        {
            "description": ("string of 1-16 parts separated by hyphens, consisting of lowercase letters and digits"),
            "regex_pattern": r"^[a-z0-9]+(?:-[a-z0-9]+){0,15}$",
        },
    ]

    for rule in predefined_rules:
        existing_rule = await validation_rule_service.crud.get_rule_by_attributes(
            target_type=ValidationRuleTargetType.STRING,
            min_value=None,
            max_value=None,
            regex_pattern=rule["regex_pattern"],
            max_length=None,
        )

        if existing_rule:
            continue

        await validation_rule_service.create_rule(
            rule=ValidationRuleBase(
                target_type=ValidationRuleTargetType.STRING,
                description=rule["description"],
                regex_pattern=rule["regex_pattern"],
            ),
            requester=user,
        )
        await session.commit()
