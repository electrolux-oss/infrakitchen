from decimal import Decimal, InvalidOperation
import re
from typing import Any

from application.resources.schema import ResourceVariableSchema
from .schema import ValidationRuleResponse


def validate_string_rule(
    variable_from_schema: ResourceVariableSchema, rule: ValidationRuleResponse, value: Any
) -> None:
    if not isinstance(value, str):
        raise ValueError(f"Variable '{variable_from_schema.name}' must be a string to satisfy validation rules.")

    if rule.max_length is not None and len(value) > rule.max_length:
        raise ValueError(f"Variable '{variable_from_schema.name}' exceeds maximum length of {rule.max_length}.")

    if rule.regex_pattern:
        _assert_regex(rule.regex_pattern, value, variable_from_schema.name)


def validate_number_rule(
    variable_from_schema: ResourceVariableSchema, rule: ValidationRuleResponse, value: Any
) -> None:
    if not _is_numeric_value(value):
        raise ValueError(f"Variable '{variable_from_schema.name}' must be numeric to satisfy validation rules.")

    numeric_value = _to_decimal(value)

    if rule.min_value is not None and numeric_value < rule.min_value:
        raise ValueError(f"Variable '{variable_from_schema.name}' is below the minimum value of {rule.min_value}.")

    if rule.max_value is not None and numeric_value > rule.max_value:
        raise ValueError(f"Variable '{variable_from_schema.name}' exceeds the maximum value of {rule.max_value}.")

    if rule.regex_pattern:
        _assert_regex(rule.regex_pattern, str(value), variable_from_schema.name)


def _assert_regex(pattern: str, candidate: str, variable_name: str) -> None:
    try:
        if re.fullmatch(pattern, candidate) is None:
            raise ValueError(f"Variable '{variable_name}' does not match required pattern '{pattern}'.")
    except re.error as exc:
        raise ValueError(f"Invalid validation rule regex for variable '{variable_name}': {exc}") from exc


def _is_numeric_value(value: Any) -> bool:
    return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)


def _to_decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return Decimal(value)
    if isinstance(value, float):
        try:
            return Decimal(str(value))
        except InvalidOperation as exc:
            raise ValueError("Unable to convert numeric value to Decimal for validation.") from exc
    raise ValueError("Unsupported numeric type for validation rules.")
