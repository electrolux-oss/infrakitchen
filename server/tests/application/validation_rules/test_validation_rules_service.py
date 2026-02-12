from decimal import Decimal
from unittest.mock import AsyncMock, Mock, call
from uuid import uuid4

import pytest

from application.validation_rules.crud import ValidationRuleCRUD
from application.validation_rules.model import ValidationRuleTargetType
from application.validation_rules.schema import (
    ValidationRuleBase,
    ValidationRuleResponse,
    ValidationRuleTemplateReference,
)
from application.validation_rules.service import ValidationRuleService
from core.errors import EntityNotFound

TEMPLATE_ID = "template-id"
VARIABLE_NAME = "size"
RULE_ID = "rule-id"


@pytest.fixture
def mock_validation_rule_crud():
    crud = Mock(spec=ValidationRuleCRUD)
    crud.get_all_rules = AsyncMock()
    crud.get_rules_by_template = AsyncMock()
    crud.get_rules_by_template_and_variable = AsyncMock()
    crud.get_references_by_template = AsyncMock()
    crud.create_rule = AsyncMock()
    crud.get_rule_by_attributes = AsyncMock()
    crud.get_rule_by_id = AsyncMock()
    crud.update_rule = AsyncMock()
    crud.delete_rule = AsyncMock()
    crud.get_references_by_template_and_variable = AsyncMock()
    crud.get_reference_by_id = AsyncMock()
    crud.create_reference = AsyncMock()
    crud.delete_reference = AsyncMock()
    return crud


@pytest.fixture
def validation_rule_service(mock_validation_rule_crud):
    return ValidationRuleService(crud=mock_validation_rule_crud)


class TestGetAllRules:
    @pytest.mark.asyncio
    async def test_returns_rules(self, validation_rule_service, mock_validation_rule_crud, monkeypatch):
        db_rule = object()
        mock_validation_rule_crud.get_all_rules.return_value = [db_rule]
        parsed_rule = Mock()
        mock_validate = Mock(return_value=parsed_rule)
        monkeypatch.setattr(ValidationRuleResponse, "model_validate", mock_validate)

        result = await validation_rule_service.get_all_rules()

        assert result == [parsed_rule]
        mock_validation_rule_crud.get_all_rules.assert_awaited_once_with()
        mock_validate.assert_called_once_with(db_rule)


class TestGetRulesForTemplate:
    @pytest.mark.asyncio
    async def test_returns_template_rules(self, validation_rule_service, mock_validation_rule_crud, monkeypatch):
        db_rule = object()
        mock_validation_rule_crud.get_rules_by_template.return_value = [db_rule]
        parsed_rule = Mock()
        mock_validate = Mock(return_value=parsed_rule)
        monkeypatch.setattr(ValidationRuleResponse, "model_validate", mock_validate)

        result = await validation_rule_service.get_rules_for_template(TEMPLATE_ID)

        assert result == [parsed_rule]
        mock_validation_rule_crud.get_rules_by_template.assert_awaited_once_with(template_id=TEMPLATE_ID)
        mock_validate.assert_called_once_with(db_rule)


class TestGetRulesForVariable:
    @pytest.mark.asyncio
    async def test_returns_variable_rules(self, validation_rule_service, mock_validation_rule_crud, monkeypatch):
        db_rule = object()
        mock_validation_rule_crud.get_rules_by_template_and_variable.return_value = [db_rule]
        parsed_rule = Mock()
        mock_validate = Mock(return_value=parsed_rule)
        monkeypatch.setattr(ValidationRuleResponse, "model_validate", mock_validate)

        result = await validation_rule_service.get_rules_for_variable(TEMPLATE_ID, VARIABLE_NAME)

        assert result == [parsed_rule]
        mock_validation_rule_crud.get_rules_by_template_and_variable.assert_awaited_once_with(
            template_id=TEMPLATE_ID,
            variable_name=VARIABLE_NAME,
        )
        mock_validate.assert_called_once_with(db_rule)


class TestGetRulesMapForTemplate:
    @pytest.mark.asyncio
    async def test_groups_rules_by_variable(self, validation_rule_service, mock_validation_rule_crud, monkeypatch):
        reference = Mock()
        reference.id = uuid4()
        reference.variable_name = "env"
        reference.validation_rule = object()
        parsed_rule = Mock()
        mock_validation_rule_crud.get_references_by_template.return_value = [reference]
        monkeypatch.setattr(ValidationRuleResponse, "model_validate", Mock(return_value=parsed_rule))

        result = await validation_rule_service.get_rules_map_for_template(template_id=str(uuid4()))

        assert result == {"env": [parsed_rule]}
        mock_validation_rule_crud.get_references_by_template.assert_awaited_once()


class TestCreateRule:
    @pytest.mark.asyncio
    async def test_attaches_creator(
        self, validation_rule_service, mock_validation_rule_crud, mock_user_dto, monkeypatch
    ):
        rule = ValidationRuleBase(target_type=ValidationRuleTargetType.STRING, description="desc", max_length=10)
        db_rule = object()
        mock_validation_rule_crud.create_rule.return_value = db_rule
        parsed_rule = Mock()
        mock_validate = Mock(return_value=parsed_rule)
        monkeypatch.setattr(ValidationRuleResponse, "model_validate", mock_validate)

        result = await validation_rule_service.create_rule(rule=rule, requester=mock_user_dto)

        expected_payload = {
            "target_type": ValidationRuleTargetType.STRING,
            "description": "desc",
            "max_length": 10,
            "created_by": mock_user_dto.id,
        }
        mock_validation_rule_crud.create_rule.assert_awaited_once_with(data=expected_payload)
        assert result is parsed_rule


class TestUpdateRule:
    @pytest.mark.asyncio
    async def test_updates_existing_rule(self, validation_rule_service, mock_validation_rule_crud, monkeypatch):
        rule_body = ValidationRuleBase(target_type=ValidationRuleTargetType.NUMBER, min_value=Decimal("1"))
        stored_rule = object()
        updated_rule = object()
        mock_validation_rule_crud.get_rule_by_id.return_value = stored_rule
        mock_validation_rule_crud.update_rule.return_value = updated_rule
        parsed_rule = Mock()
        mock_validate = Mock(return_value=parsed_rule)
        monkeypatch.setattr(ValidationRuleResponse, "model_validate", mock_validate)

        result = await validation_rule_service.update_rule(rule_id=RULE_ID, rule=rule_body)

        mock_validation_rule_crud.get_rule_by_id.assert_awaited_once_with(rule_id=RULE_ID)
        mock_validation_rule_crud.update_rule.assert_awaited_once()
        assert result is parsed_rule

    @pytest.mark.asyncio
    async def test_raises_when_rule_missing(self, validation_rule_service, mock_validation_rule_crud):
        mock_validation_rule_crud.get_rule_by_id.return_value = None
        rule_body = ValidationRuleBase(target_type=ValidationRuleTargetType.STRING)

        with pytest.raises(EntityNotFound):
            await validation_rule_service.update_rule(rule_id=RULE_ID, rule=rule_body)


class TestDeleteRule:
    @pytest.mark.asyncio
    async def test_deletes_existing_rule(self, validation_rule_service, mock_validation_rule_crud):
        db_rule = object()
        mock_validation_rule_crud.get_rule_by_id.return_value = db_rule

        await validation_rule_service.delete_rule(rule_id=RULE_ID)

        mock_validation_rule_crud.get_rule_by_id.assert_awaited_once_with(rule_id=RULE_ID)
        mock_validation_rule_crud.delete_rule.assert_awaited_once_with(db_rule)

    @pytest.mark.asyncio
    async def test_delete_raises_when_missing(self, validation_rule_service, mock_validation_rule_crud):
        mock_validation_rule_crud.get_rule_by_id.return_value = None

        with pytest.raises(EntityNotFound):
            await validation_rule_service.delete_rule(rule_id=RULE_ID)


class TestReplaceRulesForVariable:
    @pytest.mark.asyncio
    async def test_replaces_rules(self, validation_rule_service, mock_validation_rule_crud, mock_user_dto, monkeypatch):
        existing_refs = [Mock(), Mock()]
        mock_validation_rule_crud.get_references_by_template_and_variable.return_value = existing_refs
        persisted_rules = [Mock(), Mock()]
        persisted_rules[0].id = "rule-1"
        persisted_rules[1].id = "rule-2"
        mock_validation_rule_crud.get_rule_by_attributes.side_effect = persisted_rules
        created_refs = [Mock(), Mock()]
        mock_validation_rule_crud.create_reference.side_effect = created_refs
        parsed_refs = [Mock(), Mock()]
        mock_validate = Mock(side_effect=parsed_refs)
        monkeypatch.setattr(ValidationRuleTemplateReference, "model_validate", mock_validate)

        result = await validation_rule_service.replace_rules_for_variable(
            template_id=TEMPLATE_ID,
            variable_name=VARIABLE_NAME,
            rules=[
                ValidationRuleBase(target_type=ValidationRuleTargetType.STRING, regex_pattern="^foo$"),
                ValidationRuleBase(target_type=ValidationRuleTargetType.STRING, regex_pattern="^bar$"),
            ],
            requester=mock_user_dto,
        )

        mock_validation_rule_crud.delete_reference.assert_has_awaits([call(existing_refs[0]), call(existing_refs[1])])
        mock_validation_rule_crud.create_reference.assert_has_awaits(
            [
                call(
                    data={
                        "template_id": TEMPLATE_ID,
                        "variable_name": VARIABLE_NAME,
                        "validation_rule_id": "rule-1",
                        "created_by": mock_user_dto.id,
                    }
                ),
                call(
                    data={
                        "template_id": TEMPLATE_ID,
                        "variable_name": VARIABLE_NAME,
                        "validation_rule_id": "rule-2",
                        "created_by": mock_user_dto.id,
                    }
                ),
            ]
        )
        assert result == parsed_refs
        mock_validation_rule_crud.create_rule.assert_not_called()

    @pytest.mark.asyncio
    async def test_creates_missing_rules(
        self, validation_rule_service, mock_validation_rule_crud, mock_user_dto, monkeypatch
    ):
        mock_validation_rule_crud.get_references_by_template_and_variable.return_value = []
        mock_validation_rule_crud.get_rule_by_attributes.return_value = None
        new_db_rule = Mock()
        new_db_rule.id = "new-rule"
        mock_validation_rule_crud.create_rule.return_value = new_db_rule
        created_reference = Mock()
        mock_validation_rule_crud.create_reference.return_value = created_reference
        monkeypatch.setattr(ValidationRuleTemplateReference, "model_validate", Mock(return_value=Mock()))

        await validation_rule_service.replace_rules_for_variable(
            template_id=TEMPLATE_ID,
            variable_name=VARIABLE_NAME,
            rules=[ValidationRuleBase(target_type=ValidationRuleTargetType.STRING, regex_pattern="^foo$")],
            requester=mock_user_dto,
        )

        mock_validation_rule_crud.create_rule.assert_awaited_once()


class TestAddRuleForTemplate:
    @pytest.mark.asyncio
    async def test_creates_reference(
        self, validation_rule_service, mock_validation_rule_crud, mock_user_dto, monkeypatch
    ):
        persisted_rule = Mock()
        persisted_rule.id = RULE_ID
        mock_validation_rule_crud.get_rule_by_attributes.return_value = persisted_rule
        created_reference = Mock()
        mock_validation_rule_crud.create_reference.return_value = created_reference
        parsed_reference = Mock()
        mock_validate = Mock(return_value=parsed_reference)
        monkeypatch.setattr(ValidationRuleTemplateReference, "model_validate", mock_validate)

        result = await validation_rule_service.add_rule_for_template(
            template_id=TEMPLATE_ID,
            variable_name=VARIABLE_NAME,
            rule=ValidationRuleBase(target_type=ValidationRuleTargetType.STRING, regex_pattern="^foo$"),
            requester=mock_user_dto,
        )

        mock_validation_rule_crud.create_reference.assert_awaited_once_with(
            data={
                "template_id": TEMPLATE_ID,
                "variable_name": VARIABLE_NAME,
                "validation_rule_id": RULE_ID,
                "created_by": mock_user_dto.id,
            }
        )
        assert result is parsed_reference

    @pytest.mark.asyncio
    async def test_creates_rule_when_missing(
        self, validation_rule_service, mock_validation_rule_crud, mock_user_dto, monkeypatch
    ):
        mock_validation_rule_crud.get_rule_by_attributes.return_value = None
        new_rule = Mock()
        new_rule.id = RULE_ID
        mock_validation_rule_crud.create_rule.return_value = new_rule
        created_reference = Mock()
        mock_validation_rule_crud.create_reference.return_value = created_reference
        parsed_reference = Mock()
        monkeypatch.setattr(ValidationRuleTemplateReference, "model_validate", Mock(return_value=parsed_reference))

        result = await validation_rule_service.add_rule_for_template(
            template_id=TEMPLATE_ID,
            variable_name=VARIABLE_NAME,
            rule=ValidationRuleBase(target_type=ValidationRuleTargetType.STRING, regex_pattern="^foo$"),
            requester=mock_user_dto,
        )

        mock_validation_rule_crud.create_rule.assert_awaited_once()
        assert result is parsed_reference


class TestDeleteRuleReference:
    @pytest.mark.asyncio
    async def test_deletes_reference(self, validation_rule_service, mock_validation_rule_crud):
        reference = Mock()
        reference.template_id = uuid4()
        reference.variable_name = "env"
        mock_validation_rule_crud.get_reference_by_id.return_value = reference

        await validation_rule_service.delete_rule_reference(
            template_id=str(reference.template_id),
            variable_name="env",
            reference_id=str(uuid4()),
        )

        mock_validation_rule_crud.delete_reference.assert_awaited_once_with(reference)

    @pytest.mark.asyncio
    async def test_raises_when_reference_missing(self, validation_rule_service, mock_validation_rule_crud):
        mock_validation_rule_crud.get_reference_by_id.return_value = None

        with pytest.raises(EntityNotFound):
            await validation_rule_service.delete_rule_reference(
                template_id=str(uuid4()),
                variable_name="env",
                reference_id=str(uuid4()),
            )

    @pytest.mark.asyncio
    async def test_raises_when_template_or_variable_mismatch(self, validation_rule_service, mock_validation_rule_crud):
        reference = Mock()
        reference.template_id = uuid4()
        reference.variable_name = "env"
        mock_validation_rule_crud.get_reference_by_id.return_value = reference

        with pytest.raises(EntityNotFound):
            await validation_rule_service.delete_rule_reference(
                template_id=str(uuid4()),
                variable_name="cpu",
                reference_id=str(uuid4()),
            )
