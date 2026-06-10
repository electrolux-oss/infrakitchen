from graphql import GraphQLError

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
    assert message == "Internal server error"


def test_classify_auth_message_is_access_denied() -> None:
    error = GraphQLError("Not authenticated. Please provide a valid bearer token in the Authorization header.")
    code, message, _ = classify_graphql_error(error)
    assert code == "ACCESS_DENIED"
    assert message.startswith("Not authenticated")


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
