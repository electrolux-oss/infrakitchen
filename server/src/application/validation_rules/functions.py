from __future__ import annotations

import re
from collections.abc import Sequence
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from typing import Any, Protocol
from collections.abc import Callable

from .schema import ValidationRuleResponse
from .types import ValidationRuleDataType


class ValidationRuleViolation(ValueError):
    """Raised when a payload violates one or more validation rules."""


class ValidationRuleLike(Protocol):
    field_path: str
    data_type: ValidationRuleDataType
    regex: str | None
    no_whitespace: bool
    max_length: int | None
    min_value: float | None
    max_value: float | None
    rule_metadata: dict[str, Any]


Setter = Callable[[Any], None]


def apply_validation_rules(
    data: dict[str, Any],
    rules: Sequence[ValidationRuleLike | ValidationRuleResponse],
) -> dict[str, Any]:
    """Apply ValidationRule constraints to a payload dict, mutating it in-place."""
    accessor = _FieldAccessor(data)
    for rule in rules:
        value, setter = accessor.resolve(rule.field_path)
        if setter is None:
            continue

        should_update, new_value = _validate_value(rule, value)
        if should_update:
            setter(new_value)
    return data


class _FieldAccessor:
    """Helper that can resolve dotted field paths and provide setters."""

    def __init__(self, root: dict[str, Any]):
        self._root = root

    def resolve(self, field_path: str) -> tuple[Any | None, Setter | None]:
        if not field_path:
            return None, None
        segments = field_path.split(".")
        return self._resolve(self._root, segments)

    def _resolve(self, current: Any, segments: list[str]) -> tuple[Any | None, Setter | None]:
        if not segments:
            return current, None

        segment = segments[0]
        remaining = segments[1:]

        if isinstance(current, dict):
            if segment == "variables" and isinstance(current.get(segment), list):
                return self._resolve_variables(current[segment], remaining)

            if segment not in current:
                return None, None

            if not remaining:
                return current[segment], lambda new_value: current.__setitem__(segment, new_value)

            return self._resolve(current[segment], remaining)

        if isinstance(current, list):
            index = _try_parse_index(segment)
            if index is None or index >= len(current):
                return None, None

            if not remaining:
                return current[index], lambda new_value: current.__setitem__(index, new_value)

            return self._resolve(current[index], remaining)

        if hasattr(current, segment):
            attr_value = getattr(current, segment)
            if not remaining:
                return attr_value, lambda new_value: setattr(current, segment, new_value)
            return self._resolve(attr_value, remaining)

        return None, None

    def _resolve_variables(self, variables: list[Any], segments: list[str]) -> tuple[Any | None, Setter | None]:
        if not segments:
            return None, None

        target_name = segments[0]
        target = next((entry for entry in variables if _get_variable_name(entry) == target_name), None)
        if target is None:
            return None, None

        remaining = segments[1:]
        if not remaining:
            return _get_variable_value(target), lambda new_value: _set_variable_value(target, new_value)

        return self._resolve(target, remaining)


def _get_variable_name(entry: Any) -> str | None:
    if isinstance(entry, dict):
        return entry.get("name")
    return getattr(entry, "name", None)


def _get_variable_value(entry: Any) -> Any:
    if isinstance(entry, dict):
        return entry.get("value")
    return getattr(entry, "value", None)


def _set_variable_value(entry: Any, value: Any) -> None:
    if isinstance(entry, dict):
        entry["value"] = value
    else:
        entry.value = value


def _validate_value(rule: ValidationRuleLike, value: Any) -> tuple[bool, Any]:
    if rule.data_type == ValidationRuleDataType.STRING:
        return _validate_string(rule, value)
    if rule.data_type == ValidationRuleDataType.NUMBER:
        return _validate_number(rule, value)
    return False, value


def _validate_string(rule: ValidationRuleLike, value: Any) -> tuple[bool, str]:
    if value is None:
        return False, value
    if not isinstance(value, str):
        raise ValidationRuleViolation(f"{_field_label(rule)} must be a string.")

    cleaned = value.strip()

    if rule.regex:
        pattern = _compiled_regex(rule.regex)
        if pattern.fullmatch(cleaned) is None:
            raise ValidationRuleViolation(
                _metadata_message(
                    rule,
                    "regex",
                    f"{_field_label(rule)} does not match the required pattern.",
                )
            )

    if rule.max_length is not None and len(cleaned) > rule.max_length:
        raise ValidationRuleViolation(
            _metadata_message(
                rule,
                "max_length",
                f"{_field_label(rule)} must be {rule.max_length} characters or fewer.",
            )
        )

    if rule.no_whitespace and any(char.isspace() for char in cleaned):
        raise ValidationRuleViolation(
            _metadata_message(
                rule,
                "no_whitespace",
                f"{_field_label(rule)} cannot contain whitespace characters.",
            )
        )

    return True, cleaned


def _validate_number(rule: ValidationRuleLike, value: Any) -> tuple[bool, Any]:
    if value is None:
        return False, value

    decimal_value = _to_decimal(rule, value)

    if rule.min_value is not None and decimal_value < Decimal(str(rule.min_value)):
        raise ValidationRuleViolation(
            _metadata_message(
                rule,
                "min_value",
                f"{_field_label(rule)} must be greater than or equal to {rule.min_value}.",
            )
        )

    if rule.max_value is not None and decimal_value > Decimal(str(rule.max_value)):
        raise ValidationRuleViolation(
            _metadata_message(
                rule,
                "max_value",
                f"{_field_label(rule)} must be less than or equal to {rule.max_value}.",
            )
        )

    return False, value


def _to_decimal(rule: ValidationRuleLike, value: Any) -> Decimal:
    candidate = value
    if isinstance(value, str):
        candidate = value.strip()
    try:
        return Decimal(str(candidate))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationRuleViolation(f"{_field_label(rule)} must be numeric.") from exc


@lru_cache(maxsize=128)
def _compiled_regex(pattern: str) -> re.Pattern[str]:
    try:
        return re.compile(pattern)
    except re.error as exc:
        raise ValueError(f"Invalid validation rule regex '{pattern}': {exc}") from exc


def _metadata_message(rule: ValidationRuleLike, key: str, fallback: str) -> str:
    metadata = rule.rule_metadata or {}
    message = metadata.get(key)
    if isinstance(message, str) and message:
        return message
    return fallback


def _field_label(rule: ValidationRuleLike) -> str:
    metadata = rule.rule_metadata or {}
    label = metadata.get("field")
    if isinstance(label, str) and label:
        return label
    return rule.field_path


def _try_parse_index(segment: str) -> int | None:
    try:
        return int(segment)
    except ValueError:
        return None
