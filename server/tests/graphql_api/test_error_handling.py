import json
from unittest.mock import Mock

import pytest
from asyncpg import exceptions as asyncpg_exceptions
from graphql import GraphQLError
from sqlalchemy.exc import IntegrityError

from core.errors import (
    AccessDenied,
    ChildrenIsNotReady,
    CloudWrongCredentials,
    ConfigError,
    DependencyError,
    EntityExistsError,
    EntityNotFound,
    EntityWrongState,
)
from graphql_api.error_handling import classify_graphql_error, format_graphql_error


def test_classify_entity_not_found() -> None:
    error = GraphQLError("Resource not found", original_error=EntityNotFound("Resource not found"))
    code, message, extras = classify_graphql_error(error)
    assert code == "NOT_FOUND"
    assert message == "Resource not found"
    assert extras is None


def test_classify_access_denied() -> None:
    error = GraphQLError("Access denied", original_error=AccessDenied("Access denied"))
    code, message, extras = classify_graphql_error(error)
    assert code == "ACCESS_DENIED"
    assert message == "Access denied"
    assert extras is None


def test_classify_entity_wrong_state() -> None:
    error = GraphQLError("wrong state", original_error=EntityWrongState("Entity is in wrong state"))
    code, message, extras = classify_graphql_error(error)
    assert code == "WRONG_STATE"
    assert message == "Entity is in wrong state"


def test_classify_entity_exists_error() -> None:
    error = GraphQLError("exists", original_error=EntityExistsError("Already exists"))
    code, message, extras = classify_graphql_error(error)
    assert code == "CONFLICT"
    assert message == "Already exists"


def test_classify_dependency_error_includes_metadata() -> None:
    meta = [{"id": "abc", "name": "child-resource"}]
    error = GraphQLError(
        "dependency",
        original_error=DependencyError(message="Parent resource is not ready", metadata=meta),
    )
    code, message, extras = classify_graphql_error(error)
    assert code == "DEPENDENCY"
    assert message == "Parent resource is not ready"
    assert extras is not None
    assert extras["error_code"] == "DEPENDENCY_ERROR"
    assert extras["metadata"] == meta


def test_classify_dependency_error_no_metadata() -> None:
    error = GraphQLError("dependency", original_error=DependencyError(message="Cannot proceed"))
    code, message, extras = classify_graphql_error(error)
    assert code == "DEPENDENCY"
    assert extras is not None
    assert "metadata" not in extras


def test_classify_children_not_ready() -> None:
    error = GraphQLError("children", original_error=ChildrenIsNotReady("Children not ready"))
    code, message, _ = classify_graphql_error(error)
    assert code == "CHILDREN_NOT_READY"


def test_classify_value_error_is_validation() -> None:
    error = GraphQLError("bad input", original_error=ValueError("Invalid value"))
    code, message, _ = classify_graphql_error(error)
    assert code == "VALIDATION"
    assert message == "Invalid value"


def test_classify_type_error_is_validation() -> None:
    error = GraphQLError("type", original_error=TypeError("Wrong type"))
    code, message, _ = classify_graphql_error(error)
    assert code == "VALIDATION"


def test_classify_assertion_error_is_validation() -> None:
    error = GraphQLError("assertion", original_error=AssertionError("Assertion failed"))
    code, message, _ = classify_graphql_error(error)
    assert code == "VALIDATION"


def test_classify_not_implemented_error() -> None:
    error = GraphQLError("not impl", original_error=NotImplementedError("Feature not available"))
    code, message, _ = classify_graphql_error(error)
    assert code == "NOT_IMPLEMENTED"


def test_classify_config_error_is_internal() -> None:
    error = GraphQLError("config", original_error=ConfigError("Bad config"))
    code, message, _ = classify_graphql_error(error)
    assert code == "INTERNAL"
    assert message == "Internal server error"


def test_classify_cloud_wrong_credentials() -> None:
    error = GraphQLError(
        "creds",
        original_error=CloudWrongCredentials(message="Invalid credentials", metadata=[{"provider": "aws"}]),
    )
    code, message, extras = classify_graphql_error(error)
    assert code == "CREDENTIALS_ERROR"
    assert message == "Invalid credentials"
    assert extras is not None
    assert extras["error_code"] == "CREDENTIALS_ERROR"
    assert extras["metadata"] == [{"provider": "aws"}]


def test_classify_unknown_error_is_internal() -> None:
    error = GraphQLError("sqlalchemy traceback and internals")
    code, message, _ = classify_graphql_error(error)
    assert code == "INTERNAL"
    assert message == "sqlalchemy traceback and internals"


def test_classify_auth_message_is_access_denied() -> None:
    error = GraphQLError("Not authenticated. Please provide a valid bearer token in the Authorization header.")
    code, message, _ = classify_graphql_error(error)
    assert code == "ACCESS_DENIED"
    assert message.startswith("Not authenticated")


def test_classify_invalid_uuid_variable_is_validation() -> None:
    error = GraphQLError(
        "Variable '$id' got invalid value 'test'; Value cannot represent a UUID: \"test\". badly formed hexadecimal UUID string"  # noqa: E501
    )
    code, message, extras = classify_graphql_error(error)
    assert code == "VALIDATION"
    assert message.startswith("Variable '$id' got invalid value 'test'")
    assert extras is None


def test_format_includes_extensions_code() -> None:
    error = GraphQLError("Resource not found", original_error=EntityNotFound("Resource not found"))
    payload = format_graphql_error(error)
    assert payload["extensions"]["code"] == "NOT_FOUND"
    assert payload["message"] == "Resource not found"


def test_format_dependency_error_includes_metadata_in_extensions() -> None:
    meta = [{"id": "123"}]
    error = GraphQLError(
        "dep",
        original_error=DependencyError(message="Blocked by child", metadata=meta),
    )
    payload = format_graphql_error(error)
    assert payload["extensions"]["code"] == "DEPENDENCY"
    assert payload["extensions"]["metadata"] == meta
    assert payload["extensions"]["error_code"] == "DEPENDENCY_ERROR"


def _integrity_error(cause: Exception | None) -> IntegrityError:
    orig = Exception("driver error")
    orig.__cause__ = cause
    return IntegrityError("INSERT ...", {}, orig)


@pytest.mark.parametrize(
    ("cause", "expected"),
    [
        (
            asyncpg_exceptions.UniqueViolationError(
                'duplicate key value violates unique constraint "uq_secret_name" '
                "DETAIL: Key (name)=(prod) already exists."
            ),
            "A record with these values already exists.",
        ),
        (
            asyncpg_exceptions.ForeignKeyViolationError('violates foreign key constraint "fk_resource_template"'),
            "A referenced record does not exist or is still in use.",
        ),
        (
            asyncpg_exceptions.NotNullViolationError('null value in column "name" violates not-null constraint'),
            "A required value is missing.",
        ),
        (None, "The request conflicts with existing data."),
    ],
)
def test_classify_integrity_error_hides_constraint_details(cause, expected) -> None:
    error = GraphQLError("integrity", original_error=_integrity_error(cause))
    code, message, _ = classify_graphql_error(error)
    assert code == "CONFLICT"
    assert message == expected


@pytest.mark.asyncio
async def test_rest_integrity_error_hides_constraint_details() -> None:
    from app import exists_in_db_error_handler

    cause = asyncpg_exceptions.UniqueViolationError('violates unique constraint "uq_secret_name"')
    response = await exists_in_db_error_handler(Mock(), _integrity_error(cause))

    assert response.status_code == 409
    assert json.loads(bytes(response.body)) == {"message": "A record with these values already exists."}
