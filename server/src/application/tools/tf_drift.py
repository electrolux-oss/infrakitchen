"""
Drift of a resource: what the next apply would change. Read from the plan of `tofu show -json <plan>`
(`resource_changes`), with a fallback to the addresses found in the human-readable plan output.

An apply sets the infrastructure to the configuration, so the planned changes of a resource without pending
changes come from changes made outside of InfraKitchen (or from data sources and provider versions that
changed since). Attributes listed in `lifecycle.ignore_changes` and values the provider changes by itself
plan no change, so they are no drift.
"""

import json
import re
import zlib
from dataclasses import dataclass, field
from typing import Any

from .tf_summary import MAX_RESOURCES_PER_ACTION, parse_plan_resources

# keep the stored summary small: it is saved per resource and read by the resource's Drift tab
MAX_ATTRIBUTES_PER_OBJECT = 50
MAX_VALUE_LENGTH = 200
# the changes kept in the summary, JSON encoded; the rest is cut off like the changes over MAX_RESOURCES_PER_ACTION
MAX_CHANGES_BYTES = 256 * 1024
# drift keys kept per resource to tell new drift from drift that was already notified
MAX_KEYS = 500
SENSITIVE_VALUE = "(sensitive)"
REDACTED_VALUE = "(redacted)"
# attributes that often hold secrets although the provider doesn't mark them sensitive,
# e.g. Lambda environment variables, EC2 user data, connection strings. This only keeps them out of
# the saved summary: the plan output in the entity log shows them, as it does for a dry run
REDACTED_NAME = re.compile(
    r"password|passwd|secret|token|private_key|api_key|access_key|credential|user_data|environment|connection_string",
    re.IGNORECASE,
)
# tag and label maps are never redacted by name: tag keys like `Environment` are common and hold no secrets
UNREDACTED_ATTRIBUTES = {"tags", "tags_all", "labels", "effective_labels", "terraform_labels"}
_PATH_SEGMENTS = re.compile(r"[^.\[\]]+")

# planned actions of an object (`change.actions`) and how the drift names them
_ACTIONS: dict[tuple[str, ...], str] = {
    ("update",): "update",
    # the object is missing, e.g. it was deleted outside of InfraKitchen
    ("create",): "create",
    ("delete",): "delete",
    ("delete", "create"): "replace",
    ("create", "delete"): "replace",
}
# the same actions in the plan output, see tf_summary.RESOURCE_ACTIONS
_TEXT_ACTIONS = {"create": "create", "update": "update", "replace": "replace", "destroy": "delete"}


@dataclass
class DriftResult:
    summary: dict[str, Any]
    # one key per changed object or attribute value, compared between checks to notify only about new drift
    keys: list[str] = field(default_factory=list)


@dataclass
class _Change:
    attribute: dict[str, str]
    # fingerprint of the real value: a second change of the same attribute is new drift; None for hidden values
    digest: str | None


def _format_value(value: Any) -> str:
    text = json.dumps(value, sort_keys=True, default=str)
    return text if len(text) <= MAX_VALUE_LENGTH else text[: MAX_VALUE_LENGTH - 1] + "…"


def _digest(value: Any) -> str:
    """
    Fingerprint of a value already masked by `_masked`, to tell a value that changed again from the same one.
    A checksum, not a cryptographic hash: it never sees secrets and protects nothing.
    """
    return f"{zlib.crc32(json.dumps(value, sort_keys=True, default=str).encode()):08x}"


def _join(path: str, key: str) -> str:
    return f"{path}.{key}" if path else key


def _child_mask(mask: Any, key: str | int) -> Any:
    """Sensitivity (or unknown) mask of a nested value; `true` covers the whole subtree."""
    if mask is True:
        return True
    if isinstance(mask, dict) and isinstance(key, str):
        return mask.get(key)
    if isinstance(mask, list) and isinstance(key, int) and key < len(mask):
        return mask[key]
    return None


def _redacted(path: str) -> bool:
    segments = _PATH_SEGMENTS.findall(path)
    if segments and segments[0] in UNREDACTED_ATTRIBUTES:
        return False
    return any(REDACTED_NAME.search(segment) for segment in segments)


def _masked(value: Any, mask: Any, path: str) -> Any:
    """
    A value with its sensitive parts and secret-looking attributes hidden, before it is shown or hashed.
    A whole block or list is shown when it was added, removed or changed its length, so the parts
    inside it need hiding too.
    """
    if mask is True:
        return SENSITIVE_VALUE
    if path and _redacted(path):
        return REDACTED_VALUE
    if isinstance(value, dict):
        return {key: _masked(item, _child_mask(mask, key), _join(path, key)) for key, item in value.items()}
    if isinstance(value, list):
        return [_masked(item, _child_mask(mask, index), f"{path}[{index}]") for index, item in enumerate(value)]
    return value


def _changes(
    before: Any,
    after: Any,
    before_sensitive: Any = None,
    after_sensitive: Any = None,
    after_unknown: Any = None,
) -> list[_Change]:
    """Changed attributes of an object, `before` being the real value and `after` the configured one."""
    changes: list[_Change] = []

    def walk(old: Any, new: Any, old_mask: Any, new_mask: Any, unknown: Any, path: str) -> None:
        # a value known only after the apply follows from the other changes, it doesn't tell what drifted
        if unknown is True or old == new:
            return
        if old_mask is True or new_mask is True:
            hidden = {"path": path or "*", "before": SENSITIVE_VALUE, "after": SENSITIVE_VALUE}
            changes.append(_Change(hidden, None))
        elif isinstance(old, dict) and isinstance(new, dict):
            for key in sorted(set(old) | set(new)):
                walk(
                    old.get(key),
                    new.get(key),
                    _child_mask(old_mask, key),
                    _child_mask(new_mask, key),
                    _child_mask(unknown, key),
                    _join(path, key),
                )
        elif isinstance(old, list) and isinstance(new, list) and len(old) == len(new):
            for index, (old_item, new_item) in enumerate(zip(old, new, strict=True)):
                walk(
                    old_item,
                    new_item,
                    _child_mask(old_mask, index),
                    _child_mask(new_mask, index),
                    _child_mask(unknown, index),
                    f"{path}[{index}]",
                )
        elif _redacted(path):
            changes.append(_Change({"path": path, "before": REDACTED_VALUE, "after": REDACTED_VALUE}, None))
        else:
            real, configured = _masked(old, old_mask, path), _masked(new, new_mask, path)
            attribute = {"path": path or "*", "before": _format_value(real), "after": _format_value(configured)}
            changes.append(_Change(attribute, _digest(real)))

    walk(before, after, before_sensitive, after_sensitive, after_unknown, "")
    return changes


def attribute_changes(
    before: Any,
    after: Any,
    before_sensitive: Any = None,
    after_sensitive: Any = None,
    after_unknown: Any = None,
) -> list[dict[str, str]]:
    """Changed attribute paths of an object, e.g. `tags.Owner` or `ingress[0].cidr_blocks`."""
    return [change.attribute for change in _changes(before, after, before_sensitive, after_sensitive, after_unknown)]


def _build(changes: list[dict[str, Any]], source: str, keys: list[str]) -> DriftResult:
    kept: list[dict[str, Any]] = []
    size = 0
    for change in changes[:MAX_RESOURCES_PER_ACTION]:
        size += len(json.dumps(change, default=str))
        if size > MAX_CHANGES_BYTES:
            break
        kept.append(change)
    summary: dict[str, Any] = {
        "drifted": bool(changes),
        "total": len(changes),
        "source": source,
        "changes": kept,
    }
    if len(kept) < len(changes):
        summary["changes_truncated"] = True
    return DriftResult(summary=summary, keys=sorted(set(keys))[:MAX_KEYS])


def parse_drift_json(plan: dict[str, Any]) -> DriftResult:
    """Objects the next apply would change, with their changed attributes."""
    changes: list[dict[str, Any]] = []
    keys: list[str] = []
    for entry in plan.get("resource_changes") or []:
        if entry.get("mode") == "data":
            continue
        change = entry.get("change") or {}
        actions = change.get("actions") or []
        if not actions or actions in (["no-op"], ["read"]):
            continue
        address = str(entry.get("address", ""))
        action = _ACTIONS.get(tuple(actions), "+".join(actions))

        attributes: list[_Change] = []
        if action in ("update", "replace"):
            attributes = _changes(
                change.get("before"),
                change.get("after"),
                change.get("before_sensitive"),
                change.get("after_sensitive"),
                change.get("after_unknown"),
            )
        item: dict[str, Any] = {
            "address": address,
            "action": action,
            "attributes": [attribute.attribute for attribute in attributes[:MAX_ATTRIBUTES_PER_OBJECT]],
        }
        if len(attributes) > MAX_ATTRIBUTES_PER_OBJECT:
            item["attributes_truncated"] = True
        changes.append(item)

        if action != "update" or not attributes:
            keys.append(f"{address}|{action}")
        keys.extend(
            "|".join(part for part in (address, attribute.attribute["path"], attribute.digest) if part)
            for attribute in attributes
        )
    return _build(changes, "json", keys)


def parse_drift_text(output: str) -> DriftResult:
    """Fallback: the objects the plan output lists as changed, without their attributes."""
    changes: list[dict[str, Any]] = []
    for category, addresses in parse_plan_resources(output).items():
        action = _TEXT_ACTIONS.get(category)
        if action is not None:
            changes.extend({"address": address, "action": action, "attributes": []} for address in addresses)
    return _build(changes, "text", [f"{change['address']}|{change['action']}" for change in changes])
