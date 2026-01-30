from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from application.validation_rules.functions import apply_validation_rules, ValidationRuleViolation
from application.validation_rules.schema import ValidationRuleResponse
from application.validation_rules.types import ValidationRuleDataType


def _build_rule(**overrides) -> ValidationRuleResponse:
    payload: dict[str, Any] = {
        "id": uuid4(),
        "entity_name": overrides.pop("entity_name", "resource"),
        "field_path": overrides.pop("field_path", "name"),
        "data_type": overrides.pop("data_type", ValidationRuleDataType.STRING),
        "regex": overrides.pop("regex", None),
        "no_whitespace": overrides.pop("no_whitespace", False),
        "max_length": overrides.pop("max_length", None),
        "min_value": overrides.pop("min_value", None),
        "max_value": overrides.pop("max_value", None),
        "rule_metadata": overrides.pop("rule_metadata", {}),
    }
    payload.update(overrides)
    return ValidationRuleResponse(**payload)


def test_apply_validation_rules_trims_string_values() -> None:
    data = {"name": "  example-name  "}
    rule = _build_rule(field_path="name")

    apply_validation_rules(data, [rule])

    assert data["name"] == "example-name"


def test_apply_validation_rules_enforces_regex_pattern() -> None:
    data = {"name": "Invalid Name"}
    rule = _build_rule(field_path="name", regex=r"^[a-z0-9-]+$")

    with pytest.raises(ValidationRuleViolation):
        apply_validation_rules(data, [rule])


def test_apply_validation_rules_blocks_embedded_whitespace() -> None:
    data = {"name": "foo bar"}
    rule = _build_rule(field_path="name", no_whitespace=True)

    with pytest.raises(ValidationRuleViolation):
        apply_validation_rules(data, [rule])


def test_apply_validation_rules_limits_max_length_with_metadata_message() -> None:
    data = {"name": "a" * 5}
    rule = _build_rule(
        field_path="name",
        max_length=3,
        rule_metadata={"max_length": "Custom length message"},
    )

    with pytest.raises(ValidationRuleViolation, match="Custom length message"):
        apply_validation_rules(data, [rule])


def test_apply_validation_rules_handles_variable_paths() -> None:
    data = {
        "variables": [
            {"name": "cluster_name", "value": "  MyCluster  "},
            {"name": "other", "value": "value"},
        ]
    }
    rule = _build_rule(field_path="variables.cluster_name")

    apply_validation_rules(data, [rule])

    cluster_entry = next(item for item in data["variables"] if item["name"] == "cluster_name")
    assert cluster_entry["value"] == "MyCluster"


def test_apply_validation_rules_ignores_missing_variable_entries() -> None:
    data = {"variables": [{"name": "other", "value": "value"}]}
    rule = _build_rule(field_path="variables.cluster_name")

    apply_validation_rules(data, [rule])

    assert data["variables"][0]["value"] == "value"


def test_apply_validation_rules_enforces_numeric_bounds() -> None:
    data = {"replicas": 2}
    rule = _build_rule(
        field_path="replicas",
        data_type=ValidationRuleDataType.NUMBER,
        min_value=3,
        max_value=5,
    )

    with pytest.raises(ValidationRuleViolation):
        apply_validation_rules(data, [rule])


def test_apply_validation_rules_accepts_numeric_strings() -> None:
    data = {"replicas": " 4 "}
    rule = _build_rule(
        field_path="replicas",
        data_type=ValidationRuleDataType.NUMBER,
        min_value=1,
        max_value=5,
    )

    apply_validation_rules(data, [rule])

    assert data["replicas"] == " 4 "
