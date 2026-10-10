import re
from typing import Any

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
PLAN_LINE = re.compile(r"^\s*Plan: (.+?)\.\s*$", re.MULTILINE)
PLAN_COUNT = re.compile(r"(\d+) to (import|add|change|destroy)")
COMPLETE_LINE = re.compile(r"^\s*(?:Apply|Destroy) complete! Resources: (.+?)\.\s*$", re.MULTILINE)
COMPLETE_COUNT = re.compile(r"(\d+) (imported|added|changed|destroyed)")
NO_CHANGES = "No changes."

# Resource change headers of the plan, e.g. "  # module.vpc.aws_subnet.this["a"] will be created"
RESOURCE_ACTIONS = {
    "will be created": "create",
    "will be updated in-place": "update",
    "must be replaced": "replace",
    "will be replaced, as requested": "replace",
    "is tainted, so must be replaced": "replace",
    "will be destroyed": "destroy",
    "will be imported": "import",
    "will be read during apply": "read",
    "will no longer be managed by OpenTofu": "forget",
    "will no longer be managed by Terraform": "forget",
    # objects changed outside of tofu, reported before the planned changes
    "has changed": "drift",
    "has been deleted": "drift",
}
RESOURCE_LINE = re.compile(
    r"^\s*# (?P<address>[^(\s].*?)(?: \(deposed object \w+\))? (?P<action>"
    + "|".join(re.escape(action) for action in RESOURCE_ACTIONS)
    + r")\s*$",
    re.MULTILINE,
)
MOVED_LINE = re.compile(r"^\s*# (?P<address>[^(\s].*?) has moved to (?P<target>\S.*?)\s*$", re.MULTILINE)
# keeps the audit log metadata small for huge plans
MAX_RESOURCES_PER_ACTION = 200


def _clean(output: str) -> str:
    return ANSI_ESCAPE.sub("", output)


def parse_plan_resources(output: str) -> dict[str, list[str]]:
    """
    Addresses of the resources in a `tofu plan` output grouped by the planned action,
    `tofu apply` and `tofu destroy` print the plan before applying it.
    """
    output = _clean(output)
    resources: dict[str, list[str]] = {}

    def add(action: str, address: str):
        addresses = resources.setdefault(action, [])
        # apply prints the plan once, but drift and change sections can repeat an address
        if address not in addresses:
            addresses.append(address)

    for match in RESOURCE_LINE.finditer(output):
        add(RESOURCE_ACTIONS[match.group("action")], match.group("address"))
    for match in MOVED_LINE.finditer(output):
        add("move", f"{match.group('address')} -> {match.group('target')}")
    return resources


def _with_resources(summary: dict[str, Any], output: str) -> dict[str, Any]:
    resources = parse_plan_resources(output)
    if resources:
        summary["resources"] = {action: addresses[:MAX_RESOURCES_PER_ACTION] for action, addresses in resources.items()}
        if any(len(addresses) > MAX_RESOURCES_PER_ACTION for addresses in resources.values()):
            summary["resources_truncated"] = True
    return summary


def parse_plan_summary(output: str) -> dict[str, Any] | None:
    """
    Resource changes of a `tofu plan` output, e.g.
    "Plan: 1 to import, 2 to add, 0 to change, 1 to destroy."
    """
    output = _clean(output)
    summary: dict[str, Any] = {"import": 0, "add": 0, "change": 0, "destroy": 0}
    match = PLAN_LINE.search(output)
    if match:
        for count, kind in PLAN_COUNT.findall(match.group(1)):
            summary[kind] = int(count)
    elif NO_CHANGES not in output and "Changes to Outputs:" not in output:
        return None
    summary["has_changes"] = any(summary[kind] for kind in ("import", "add", "change", "destroy"))
    return _with_resources(summary, output)


def parse_apply_summary(output: str) -> dict[str, Any] | None:
    """
    Resource changes of a `tofu apply` or `tofu destroy` output, e.g.
    "Apply complete! Resources: 2 added, 0 changed, 1 destroyed."
    """
    output = _clean(output)
    match = COMPLETE_LINE.search(output)
    if not match:
        return None
    summary: dict[str, Any] = {"imported": 0, "added": 0, "changed": 0, "destroyed": 0}
    for count, kind in COMPLETE_COUNT.findall(match.group(1)):
        summary[kind] = int(count)
    return _with_resources(summary, output)
