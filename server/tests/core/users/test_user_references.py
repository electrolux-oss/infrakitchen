import graphql_api.schema  # noqa: F401  # registers every model on Base.metadata

from core.users.crud import get_user_references


def _policies() -> dict[tuple[str, str], str]:
    return {(ref.table.name, ref.column.name): ref.policy for ref in get_user_references()}


def test_user_owned_rows_are_deleted():
    policies = _policies()
    assert policies[("audit_logs", "user_id")] == "delete"
    assert policies[("personal_access_tokens", "user_id")] == "delete"
    assert policies[("favorites", "user_id")] == "delete"
    assert policies[("tasks", "created_by")] == "delete"
    assert policies[("project_owners", "user_id")] == "delete"
    assert policies[("resources_temp_state", "created_by")] == "delete"


def test_nullable_references_are_cleared():
    policies = _policies()
    assert policies[("task_queue", "created_by")] == "clear"
    assert policies[("casbin_rules", "created_by")] == "clear"


def test_created_entities_block_deletion():
    policies = _policies()
    assert policies[("resources", "created_by")] == "block"
    assert policies[("templates", "created_by")] == "block"
