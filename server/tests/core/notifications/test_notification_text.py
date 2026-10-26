import pytest

from core.notifications.text import action_label, entity_reference, notification_message, notification_title


@pytest.mark.parametrize(
    "action,expected",
    [
        ("dryrun", "plan"),
        ("dryrun_with_temp_state", "plan"),
        ("execute", "apply"),
        ("cascade_destroy", "cascade destroy"),
        (None, "task"),
    ],
)
def test_action_label(action, expected):
    assert action_label(action) == expected


def test_title_is_entity_type_and_event_in_sentence_case():
    assert notification_title("source_code_version", "sync failed") == "Source code version sync failed"


def test_entity_reference_falls_back_to_id():
    assert entity_reference("resource", "orders-db", "123") == "resource orders-db"
    assert entity_reference("resource", None, "123") == "resource 123"


def test_message_is_capitalized_and_ends_with_a_period():
    assert notification_message("plan for resource orders-db failed") == "Plan for resource orders-db failed."
    assert notification_message("Done.") == "Done."
