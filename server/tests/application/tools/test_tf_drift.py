import json
from typing import Any
import tempfile
from unittest.mock import AsyncMock, Mock

import pytest

from application.tools import tf_client as tf_client_module
from application.tools.tf_client import OtfClient
from application.tools.tf_drift import (
    MAX_ATTRIBUTES_PER_OBJECT,
    MAX_CHANGES_BYTES,
    MAX_VALUE_LENGTH,
    MAX_KEYS,
    REDACTED_VALUE,
    SENSITIVE_VALUE,
    _digest,
    attribute_changes,
    parse_drift_json,
    parse_drift_text,
)
from application.tools.tf_summary import MAX_RESOURCES_PER_ACTION
from core.errors import ShellExecutionError

IN_SYNC_OUTPUT = "No changes. Your infrastructure matches the configuration."
DRIFT_OUTPUT = """
Note: Objects have changed outside of OpenTofu

OpenTofu detected the following changes made outside of OpenTofu since the last "tofu apply":

  # aws_s3_bucket.this has changed
  ~ resource "aws_s3_bucket" "this" {
      ~ tags = {}
    }

OpenTofu will perform the following actions:

  # aws_s3_bucket.this will be updated in-place
  ~ resource "aws_s3_bucket" "this" {
      ~ tags = {}
    }

  # aws_iam_role.app will be created
  + resource "aws_iam_role" "app" {}

Plan: 1 to add, 1 to change, 0 to destroy.
"""


def change_entry(address: str, before, after, actions=("update",), mode="managed", **change) -> dict[str, Any]:
    """A `resource_changes` entry: `before` is the real value, `after` the configured one."""
    return {
        "address": address,
        "mode": mode,
        "change": {"actions": list(actions), "before": before, "after": after, **change},
    }


PLAN_JSON = {
    "resource_changes": [
        # the Owner tag was changed outside to "b"; the apply sets it back to "a"
        change_entry("aws_s3_bucket.this", {"tags": {"Owner": "b"}}, {"tags": {"Owner": "a"}}),
        # deleted outside: the apply creates it again
        change_entry("aws_iam_role.app", None, {"name": "app"}, actions=("create",)),
    ]
}


def addresses(result) -> list[str]:
    return [change["address"] for change in result.summary["changes"]]


def make_client(monkeypatch, mock_entity_logger, plan_output: str, show_output: str | Exception):
    """Shell client mock: the plan prints `plan_output`, `show -json` prints (or raises) `show_output`."""

    def run_for(command_args, **kwargs):
        instance = Mock()
        is_show = isinstance(command_args, list) and command_args[0] == "show"
        if is_show and isinstance(show_output, Exception):
            instance.run_shell_command = AsyncMock(side_effect=show_output)
        else:
            instance.run_shell_command = AsyncMock(return_value=show_output if is_show else plan_output)
        return instance

    shell_client = Mock(side_effect=lambda **kwargs: run_for(**kwargs))
    monkeypatch.setattr(tf_client_module, "ShellScriptClient", shell_client)
    client = OtfClient(
        workspace_path=tempfile.mkdtemp(),
        environment_variables={},
        variables={},
        backend_storage_config="",
        logger=mock_entity_logger,
    )
    return client, shell_client


@pytest.mark.asyncio
async def test_drift_check_plans_without_lock(monkeypatch, mock_entity_logger):
    client, shell_client = make_client(monkeypatch, mock_entity_logger, IN_SYNC_OUTPUT, json.dumps({}))

    result = await client.drift_check()

    assert result.summary["drifted"] is False
    assert result.summary["total"] == 0
    assert result.keys == []
    plan_call, show_call = shell_client.call_args_list
    # a normal plan: what the next apply would change, so ignore_changes is honored
    assert plan_call.kwargs["command_args"].split() == ["plan", "-lock=false", "-input=false", "-out=drift.tfplan"]
    assert show_call.kwargs["command_args"] == ["show", "-json", "drift.tfplan"]
    # the JSON holds attribute values, it is not written to the entity log
    assert show_call.kwargs["log_stdout"] is False
    assert plan_call.kwargs["log_stdout"] is True


@pytest.mark.asyncio
async def test_drift_check_reads_the_json_plan(monkeypatch, mock_entity_logger):
    client, _ = make_client(monkeypatch, mock_entity_logger, DRIFT_OUTPUT, json.dumps(PLAN_JSON))
    add_result = Mock()
    monkeypatch.setattr(mock_entity_logger, "add_result", add_result)

    result = await client.drift_check()

    assert result.summary["source"] == "json"
    assert addresses(result) == ["aws_s3_bucket.this", "aws_iam_role.app"]
    # the real value next to the configured one
    assert result.summary["changes"][0]["attributes"] == [{"path": "tags.Owner", "before": '"b"', "after": '"a"'}]
    assert result.summary["changes"][1]["action"] == "create"
    assert result.keys == ["aws_iam_role.app|create", f"aws_s3_bucket.this|tags.Owner|{_digest('b')}"]
    # the task result in the audit log stays small
    logged = add_result.call_args.kwargs["drift"]
    assert "changes" not in logged
    assert logged["total"] == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("show_output", [ShellExecutionError("show failed"), "not json"])
async def test_drift_check_falls_back_to_the_plan_output(monkeypatch, mock_entity_logger, show_output):
    client, _ = make_client(monkeypatch, mock_entity_logger, DRIFT_OUTPUT, show_output)

    result = await client.drift_check()

    assert result.summary["source"] == "text"
    # the objects changed outside are listed again under the planned actions: counted once
    assert addresses(result) == ["aws_s3_bucket.this", "aws_iam_role.app"]
    assert [change["action"] for change in result.summary["changes"]] == ["update", "create"]
    assert result.summary["total"] == 2
    assert result.keys == ["aws_iam_role.app|create", "aws_s3_bucket.this|update"]


@pytest.mark.asyncio
async def test_drift_check_truncates_huge_results(monkeypatch, mock_entity_logger):
    output = "\n".join(f"  # aws_s3_bucket.b{i} will be updated in-place" for i in range(MAX_RESOURCES_PER_ACTION + 5))
    client, _ = make_client(monkeypatch, mock_entity_logger, output, ShellExecutionError("show failed"))

    result = await client.drift_check()

    assert len(result.summary["changes"]) == MAX_RESOURCES_PER_ACTION
    assert result.summary["changes_truncated"] is True
    # the total is kept, so the notification can tell how many objects drifted
    assert result.summary["total"] == MAX_RESOURCES_PER_ACTION + 5


def test_objects_only_changed_outside_are_no_drift():
    """Changes the plan doesn't undo (ignore_changes, values the provider sets) are no drift."""
    output = """
  # aws_autoscaling_group.this has changed
  ~ resource "aws_autoscaling_group" "this" {
      ~ desired_capacity = 2 -> 3
    }

No changes. Your infrastructure matches the configuration.
"""

    result = parse_drift_text(output)

    assert result.summary["drifted"] is False
    assert result.keys == []


@pytest.mark.parametrize(
    "actions,expected",
    [
        (("update",), "update"),
        (("create",), "create"),
        (("delete",), "delete"),
        (("delete", "create"), "replace"),
        (("create", "delete"), "replace"),
    ],
)
def test_planned_actions_name_the_drift(actions, expected):
    before = None if actions == ("create",) else {"size": 1}
    after = None if actions == ("delete",) else {"size": 2}

    result = parse_drift_json({"resource_changes": [change_entry("aws_ebs_volume.data", before, after, actions)]})

    change = result.summary["changes"][0]
    assert change["action"] == expected
    # only changed objects list their attributes
    assert bool(change["attributes"]) is (expected in ("update", "replace"))
    if expected != "update":
        assert f"aws_ebs_volume.data|{expected}" in result.keys


def test_data_sources_no_op_and_read_entries_are_skipped():
    plan = {
        "resource_changes": [
            change_entry("data.aws_ami.latest", {"id": "a"}, {"id": "b"}, mode="data"),
            change_entry("aws_s3_bucket.this", {"a": 1}, {"a": 1}, actions=("no-op",)),
            change_entry("aws_s3_bucket.logs", {"a": 1}, {"a": 1}, actions=("read",)),
        ]
    }

    result = parse_drift_json(plan)

    assert result.summary["drifted"] is False
    assert result.keys == []


def test_values_known_only_after_apply_are_not_listed():
    entry = change_entry(
        "aws_instance.web",
        {"instance_type": "t3.large", "arn": "arn:1", "tags": {"a": "1"}},
        {"instance_type": "t3.micro", "tags": {"a": "1"}},
        after_unknown={"arn": True, "tags": {}},
    )

    result = parse_drift_json({"resource_changes": [entry]})

    assert result.summary["changes"][0]["attributes"] == [
        {"path": "instance_type", "before": '"t3.large"', "after": '"t3.micro"'}
    ]


def test_an_update_without_listed_attributes_still_drifted():
    # e.g. only a value known after apply changes
    entry = change_entry("aws_instance.web", {"arn": "arn:1"}, {}, after_unknown={"arn": True})

    result = parse_drift_json({"resource_changes": [entry]})

    assert result.summary["drifted"] is True
    assert result.keys == ["aws_instance.web|update"]


def test_attribute_changes_walks_dicts_and_lists():
    before = {"tags": {"Owner": "a", "Env": "dev"}, "ingress": [{"cidr": "10.0.0.0/8"}], "ports": [80]}
    after = {"tags": {"Owner": "b", "Env": "dev"}, "ingress": [{"cidr": "0.0.0.0/0"}], "ports": [80, 443]}

    changes = attribute_changes(before, after)

    assert [change["path"] for change in changes] == ["ingress[0].cidr", "ports", "tags.Owner"]
    assert changes[1] == {"path": "ports", "before": "[80]", "after": "[80, 443]"}


def test_attribute_changes_masks_sensitive_values():
    changes = attribute_changes(
        {"password": "old", "name": "a"},
        {"password": "new", "name": "a"},
        {"password": True},
        {"password": True},
    )

    assert changes == [{"path": "password", "before": SENSITIVE_VALUE, "after": SENSITIVE_VALUE}]


def broker(*users: tuple[str, str]) -> dict[str, Any]:
    return {"user": [{"username": name, "password": password} for name, password in users]}


def broker_mask(count: int) -> dict[str, Any]:
    return {"user": [{"password": True} for _ in range(count)]}


def test_sensitive_values_in_a_list_that_changed_length_stay_hidden():
    # a user was added outside: the list is shown whole, its passwords must not be
    entry = change_entry(
        "aws_mq_broker.this",
        broker(("admin", "S3cr3t-A"), ("eve", "S3cr3t-B")),
        broker(("admin", "S3cr3t-A")),
        before_sensitive=broker_mask(2),
        after_sensitive=broker_mask(1),
    )

    result = parse_drift_json({"resource_changes": [entry]})

    assert "S3cr3t" not in json.dumps(result.summary)
    attribute = result.summary["changes"][0]["attributes"][0]
    assert attribute["path"] == "user"
    assert "eve" in attribute["before"] and SENSITIVE_VALUE in attribute["before"]


def test_the_drift_key_of_a_masked_value_does_not_depend_on_the_hidden_parts():
    def keys(password: str) -> list[str]:
        entry = change_entry(
            "aws_mq_broker.this",
            broker(("admin", "a"), ("eve", password)),
            broker(("admin", "a")),
            before_sensitive=broker_mask(2),
            after_sensitive=broker_mask(1),
        )
        return parse_drift_json({"resource_changes": [entry]}).keys

    assert keys("S3cr3t-B") == keys("S3cr3t-C")


def test_sensitive_values_in_an_added_or_removed_block_stay_hidden():
    entry = change_entry(
        "aws_db_proxy.this",
        {"auth": {"username": "app", "password": "hunter2"}},
        {"auth": None},
        before_sensitive={"auth": {"password": True}},
        after_sensitive={},
    )

    result = parse_drift_json({"resource_changes": [entry]})

    assert "hunter2" not in json.dumps(result.summary)
    assert result.summary["changes"][0]["attributes"][0]["before"] == json.dumps(
        {"password": SENSITIVE_VALUE, "username": "app"}, sort_keys=True
    )


def test_secret_looking_names_in_a_changed_block_are_redacted():
    # nothing is marked sensitive, the name tells
    result = parse_drift_json(
        {"resource_changes": [change_entry("x.y", {"settings": {"db_password": "pw", "size": 1}}, {"settings": None})]}
    )

    assert '"pw"' not in json.dumps(result.summary)
    assert REDACTED_VALUE in result.summary["changes"][0]["attributes"][0]["before"]


def test_attribute_changes_truncates_long_values():
    changes = attribute_changes({"policy": "a"}, {"policy": "x" * 1000})

    assert len(changes[0]["after"]) == MAX_VALUE_LENGTH


def test_attribute_changes_are_capped_per_object():
    before = {f"tag{i}": "a" for i in range(MAX_ATTRIBUTES_PER_OBJECT + 5)}
    after = {f"tag{i}": "b" for i in range(MAX_ATTRIBUTES_PER_OBJECT + 5)}

    result = parse_drift_json({"resource_changes": [change_entry("aws_s3_bucket.this", before, after)]})

    change = result.summary["changes"][0]
    assert len(change["attributes"]) == MAX_ATTRIBUTES_PER_OBJECT
    assert change["attributes_truncated"] is True
    # every change keeps its key, so a new one is still notified
    assert len(result.keys) == MAX_ATTRIBUTES_PER_OBJECT + 5


def test_attribute_changes_redact_secret_looking_names():
    before = {"environment": [{"variables": {"DB_HOST": "a"}}], "user_data": "x", "name": "a"}
    after = {"environment": [{"variables": {"DB_HOST": "b"}}], "user_data": "y", "name": "b"}

    changes = attribute_changes(before, after)

    assert changes == [
        {"path": "environment[0].variables.DB_HOST", "before": REDACTED_VALUE, "after": REDACTED_VALUE},
        {"path": "name", "before": '"a"', "after": '"b"'},
        {"path": "user_data", "before": REDACTED_VALUE, "after": REDACTED_VALUE},
    ]


def test_tags_are_not_redacted_by_name():
    # `Environment` is one of the most common tags and holds no secret
    before = {"tags": {"Environment": "dev"}, "tags_all": {"Environment": "dev"}}
    after = {"tags": {"Environment": "prod"}, "tags_all": {"Environment": "prod"}}

    changes = attribute_changes(before, after)

    assert changes == [
        {"path": "tags.Environment", "before": '"dev"', "after": '"prod"'},
        {"path": "tags_all.Environment", "before": '"dev"', "after": '"prod"'},
    ]


def test_the_saved_changes_fit_the_size_budget():
    # each object changes MAX_ATTRIBUTES_PER_OBJECT long values: far fewer than the object limit fit the budget
    long_value = "x" * MAX_VALUE_LENGTH
    before = {f"attr{i}": long_value for i in range(MAX_ATTRIBUTES_PER_OBJECT)}
    after = {f"attr{i}": "a" for i in range(MAX_ATTRIBUTES_PER_OBJECT)}
    entries = [change_entry(f"aws_s3_bucket.b{i}", before, after) for i in range(MAX_RESOURCES_PER_ACTION)]

    result = parse_drift_json({"resource_changes": entries})

    assert len(json.dumps(result.summary["changes"])) <= MAX_CHANGES_BYTES
    assert 0 < len(result.summary["changes"]) < MAX_RESOURCES_PER_ACTION
    assert result.summary["changes_truncated"] is True
    # the total and the drift keys still cover every object
    assert result.summary["total"] == MAX_RESOURCES_PER_ACTION


def test_drift_keys_change_with_the_real_value():
    """An attribute changed outside again is new drift; hidden values are keyed by path only."""

    def keys(owner: str, password: str) -> list[str]:
        entry = change_entry(
            "aws_s3_bucket.this",
            {"tags": {"Owner": owner}, "password": password},
            {"tags": {"Owner": "a"}, "password": "p"},
        )
        return parse_drift_json({"resource_changes": [entry]}).keys

    assert keys("b", "p1") != keys("c", "p1")
    assert keys("b", "p1") == keys("b", "p2")
    assert "aws_s3_bucket.this|password" in keys("b", "p1")


def test_drift_keys_are_capped():
    before = {f"tag{i}": "a" for i in range(MAX_KEYS + 10)}
    after = {f"tag{i}": "b" for i in range(MAX_KEYS + 10)}

    result = parse_drift_json({"resource_changes": [change_entry("aws_s3_bucket.this", before, after)]})

    assert len(result.keys) == MAX_KEYS
