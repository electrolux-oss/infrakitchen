"""Shared wording for notification titles and messages.

Every notification follows the same format:
- title: ``<Entity type> <event>`` in sentence case, without names or IDs, e.g. "Resource plan failed".
- message: one sentence naming the entity as ``<entity type> <name>``, optionally followed by
  ``: <reason>`` and a second sentence with details, e.g.
  "Plan for resource orders-db failed: CannotProceed." / "Resource orders-db was updated. Status: done."
"""

from typing import Any

# Task actions as users know them in the UI
_ACTION_LABELS = {
    "execute": "apply",
    "dryrun": "plan",
    "dryrun_with_temp_state": "plan",
    "cascade_dryrun": "cascade plan",
    "cascade_execute": "cascade apply",
}


def _humanize(value: Any) -> str:
    return str(value).replace("_", " ")


def _capitalize(text: str) -> str:
    return text[:1].upper() + text[1:]


def action_label(action: Any) -> str:
    """``dryrun`` -> ``plan``, ``execute`` -> ``apply``, ``cascade_destroy`` -> ``cascade destroy``."""
    return _ACTION_LABELS.get(str(action), _humanize(action)) if action else "task"


def notification_title(entity_type: str, event: str) -> str:
    return _capitalize(f"{_humanize(entity_type)} {event}")


def entity_reference(entity_type: str, entity_name: str | None = None, entity_id: Any = None) -> str:
    """``resource orders-db``, falling back to the ID when the name is unknown."""
    return f"{_humanize(entity_type)} {entity_name or entity_id}".strip()


def notification_message(text: str) -> str:
    """Sentence-case the message and make sure it ends with a period."""
    text = _capitalize(text.strip())
    return text if text.endswith((".", "!", "?")) else f"{text}."
