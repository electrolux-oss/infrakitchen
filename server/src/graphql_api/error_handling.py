import json
import logging
from typing import Any

from fastapi.exceptions import RequestValidationError
from graphql import GraphQLError
from sqlalchemy.exc import IntegrityError

from core.errors import (
    AccessDenied,
    AccessUnauthorized,
    CannotProceed,
    ChildrenIsNotReady,
    CloudWrongCredentials,
    ConfigError,
    DependencyError,
    EntityExistsError,
    EntityNotFound,
    EntityValueError,
    EntityWrongState,
)
from core.utils.json_encoder import JsonEncoder

logger = logging.getLogger(__name__)


def _unwrap_original_error(error: GraphQLError) -> Exception | None:
    current: Exception | None = error.original_error if isinstance(error.original_error, Exception) else None
    visited: set[int] = set()

    while current is not None and id(current) not in visited:
        visited.add(id(current))
        nested = getattr(current, "original_error", None)
        if not isinstance(nested, Exception):
            break
        current = nested

    return current


def _sanitize_message(message: str) -> str:
    sanitized = " ".join(message.split())
    if len(sanitized) > 300:
        sanitized = f"{sanitized[:297]}..."
    return sanitized


def classify_graphql_error(error: GraphQLError) -> tuple[str, str, dict[str, Any] | None]:
    original = _unwrap_original_error(error)

    if original is not None:
        if isinstance(original, EntityNotFound):
            return "NOT_FOUND", _sanitize_message(str(original)), None

        if isinstance(original, AccessDenied):
            return "ACCESS_DENIED", _sanitize_message(str(original)), None

        if isinstance(original, AccessUnauthorized):
            return "UNAUTHORIZED", _sanitize_message(str(original)), None

        if isinstance(original, EntityWrongState):
            return "WRONG_STATE", _sanitize_message(str(original)), None

        if isinstance(original, DependencyError):
            extras: dict[str, Any] = {"error_code": original.error_code}
            if original.metadata:
                extras["metadata"] = original.metadata
            return "DEPENDENCY", _sanitize_message(original.message), extras

        if isinstance(original, EntityExistsError):
            return "CONFLICT", _sanitize_message(str(original)), None

        if isinstance(original, IntegrityError):
            safe_msg = (
                str(original.orig.__cause__)
                if original.orig and original.orig.__cause__
                else "A conflicting record already exists."
            )
            return "CONFLICT", _sanitize_message(safe_msg), None

        if isinstance(original, ChildrenIsNotReady):
            return "CHILDREN_NOT_READY", _sanitize_message(str(original)), None

        if isinstance(original, CannotProceed):
            return "CANNOT_PROCEED", _sanitize_message(str(original)), None

        if isinstance(original, (ValueError, TypeError, RequestValidationError, EntityValueError)):
            return "VALIDATION", _sanitize_message(str(original)), None

        if isinstance(original, ConfigError):
            return "INTERNAL", "Internal server error", None

        if isinstance(original, CloudWrongCredentials):
            extras = {"error_code": original.error_code}
            if original.metadata:
                extras["metadata"] = original.metadata
            return "CREDENTIALS_ERROR", _sanitize_message(original.message), extras

        if isinstance(original, AssertionError):
            return "VALIDATION", _sanitize_message(str(original)) or "Assertion failed.", None

        if isinstance(original, NotImplementedError):
            return "NOT_IMPLEMENTED", _sanitize_message(str(original)), None

    # Strawberry permission errors are plain GraphQLError without original_error.
    if error.message.startswith("Not authenticated"):
        return "ACCESS_DENIED", _sanitize_message(error.message), None

    return "INTERNAL", _sanitize_message(error.message), None


def format_graphql_error(error: GraphQLError) -> dict[str, Any]:
    code, message, extras = classify_graphql_error(error)
    formatted = error.formatted

    extensions: dict[str, Any] = {"code": code}
    if extras:
        extensions.update(json.loads(json.dumps(extras, cls=JsonEncoder)))

    result: dict[str, Any] = {
        "message": message,
        "extensions": extensions,
    }

    if locations := formatted.get("locations"):
        result["locations"] = locations
    if path := formatted.get("path"):
        result["path"] = path

    return result


def log_graphql_error(error: GraphQLError) -> None:
    code, message, _ = classify_graphql_error(error)
    original = _unwrap_original_error(error)

    if code == "INTERNAL":
        logger.error("GraphQL internal error: %s", message, exc_info=original or True)
        return

    logger.warning("GraphQL error code=%s message=%s", code, message)
