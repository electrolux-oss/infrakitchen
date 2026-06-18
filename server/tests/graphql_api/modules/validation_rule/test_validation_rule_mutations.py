from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.validation_rules.schema import ValidationRuleTemplateReference
from graphql_api.schema import schema

ADD_VALIDATION_RULE_MUTATION = """
    mutation AddValidationRule($templateId: UUID!, $variableName: String!, $rule: ValidationRuleInput!) {
        addValidationRule(templateId: $templateId, variableName: $variableName, rule: $rule) {
            id
            templateId
            variableName
            validationRuleId
        }
    }
"""

REPLACE_VALIDATION_RULES_MUTATION = """
    mutation ReplaceValidationRules($templateId: UUID!, $variableName: String!, $rules: [ValidationRuleInput!]!) {
        replaceValidationRules(templateId: $templateId, variableName: $variableName, rules: $rules) {
            id
            templateId
            variableName
            validationRuleId
        }
    }
"""

DELETE_VALIDATION_RULE_MUTATION = """
    mutation DeleteValidationRule($templateId: UUID!, $variableName: String!, $referenceId: UUID!) {
        deleteValidationRule(templateId: $templateId, variableName: $variableName, referenceId: $referenceId)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


@pytest.fixture
def validation_rule_reference():
    return ValidationRuleTemplateReference(
        id=uuid4(),
        template_id=uuid4(),
        variable_name="cpu",
        validation_rule_id=uuid4(),
    )


class TestValidationRuleMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.validation_rule.mutations.get_validation_rule_service")
    async def test_add_validation_rule_returns_reference(
        self,
        mock_get_service,
        mocked_user,
        validation_rule_reference,
    ):
        service = Mock()
        service.add_rule_for_template = AsyncMock(return_value=validation_rule_reference)
        mock_get_service.return_value = service

        result = await schema.execute(
            ADD_VALIDATION_RULE_MUTATION,
            variable_values={
                "templateId": str(validation_rule_reference.template_id),
                "variableName": validation_rule_reference.variable_name,
                "rule": {
                    "targetType": "STRING",
                    "regexPattern": "^foo$",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["addValidationRule"] == {
            "id": str(validation_rule_reference.id),
            "templateId": str(validation_rule_reference.template_id),
            "variableName": validation_rule_reference.variable_name,
            "validationRuleId": str(validation_rule_reference.validation_rule_id),
        }
        service.add_rule_for_template.assert_awaited_once_with(
            template_id=validation_rule_reference.template_id,
            variable_name=validation_rule_reference.variable_name,
            rule=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.validation_rule.mutations.get_validation_rule_service")
    async def test_replace_validation_rules_returns_references(
        self,
        mock_get_service,
        mocked_user,
        validation_rule_reference,
    ):
        service = Mock()
        service.replace_rules_for_variable = AsyncMock(return_value=[validation_rule_reference])
        mock_get_service.return_value = service

        result = await schema.execute(
            REPLACE_VALIDATION_RULES_MUTATION,
            variable_values={
                "templateId": str(validation_rule_reference.template_id),
                "variableName": validation_rule_reference.variable_name,
                "rules": [
                    {
                        "id": str(validation_rule_reference.validation_rule_id),
                        "targetType": "STRING",
                        "regexPattern": "^foo$",
                    }
                ],
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["replaceValidationRules"] == [
            {
                "id": str(validation_rule_reference.id),
                "templateId": str(validation_rule_reference.template_id),
                "variableName": validation_rule_reference.variable_name,
                "validationRuleId": str(validation_rule_reference.validation_rule_id),
            }
        ]
        service.replace_rules_for_variable.assert_awaited_once_with(
            template_id=validation_rule_reference.template_id,
            variable_name=validation_rule_reference.variable_name,
            rules=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.validation_rule.mutations.get_validation_rule_service")
    async def test_delete_validation_rule_returns_true(
        self,
        mock_get_service,
        mocked_user,
        validation_rule_reference,
    ):
        service = Mock()
        service.delete_rule_reference = AsyncMock()
        mock_get_service.return_value = service

        result = await schema.execute(
            DELETE_VALIDATION_RULE_MUTATION,
            variable_values={
                "templateId": str(validation_rule_reference.template_id),
                "variableName": validation_rule_reference.variable_name,
                "referenceId": str(validation_rule_reference.id),
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteValidationRule": True}
        service.delete_rule_reference.assert_awaited_once_with(
            template_id=validation_rule_reference.template_id,
            variable_name=validation_rule_reference.variable_name,
            reference_id=validation_rule_reference.id,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.validation_rule.mutations.get_validation_rule_service")
    async def test_add_validation_rule_requires_authentication(
        self,
        mock_get_service,
    ):
        service = Mock()
        service.add_rule_for_template = AsyncMock()
        mock_get_service.return_value = service

        request = Mock()
        request.state = SimpleNamespace(user=None)

        result = await schema.execute(
            ADD_VALIDATION_RULE_MUTATION,
            variable_values={
                "templateId": str(uuid4()),
                "variableName": "cpu",
                "rule": {
                    "targetType": "STRING",
                    "regexPattern": "^foo$",
                },
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["addValidationRule"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        service.add_rule_for_template.assert_not_awaited()
