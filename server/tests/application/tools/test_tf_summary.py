from application.tools.tf_summary import (
    MAX_RESOURCES_PER_ACTION,
    parse_apply_summary,
    parse_plan_resources,
    parse_plan_summary,
)


def test_parse_plan_summary_with_changes():
    output = "\x1b[1mPlan:\x1b[0m 1 to import, 2 to add, 0 to change, 3 to destroy."

    assert parse_plan_summary(output) == {
        "import": 1,
        "add": 2,
        "change": 0,
        "destroy": 3,
        "has_changes": True,
    }


def test_parse_plan_summary_without_changes():
    output = "No changes. Your infrastructure matches the configuration."

    assert parse_plan_summary(output) == {
        "import": 0,
        "add": 0,
        "change": 0,
        "destroy": 0,
        "has_changes": False,
    }


def test_parse_plan_summary_unknown_output():
    assert parse_plan_summary("Error: something went wrong") is None


def test_parse_apply_summary():
    output = "Plan: 2 to add, 0 to change, 1 to destroy.\nApply complete! Resources: 2 added, 0 changed, 1 destroyed."

    assert parse_apply_summary(output) == {"imported": 0, "added": 2, "changed": 0, "destroyed": 1}


def test_parse_destroy_summary():
    output = "\x1b[0m\x1b[1m\x1b[32mDestroy complete! Resources: 4 destroyed.\x1b[0m"

    assert parse_apply_summary(output) == {"imported": 0, "added": 0, "changed": 0, "destroyed": 4}


def test_parse_apply_summary_unknown_output():
    assert parse_apply_summary("") is None


PLAN_OUTPUT = """
Note: Objects have changed outside of OpenTofu

  # aws_s3_bucket.logs has been deleted
  - resource "aws_s3_bucket" "logs" {
    }

OpenTofu will perform the following actions:

  # aws_instance.web will be updated in-place
  ~ resource "aws_instance" "web" {
        # (12 unchanged attributes hidden)
    }

  \x1b[1m# module.vpc.aws_subnet.this["eu central 1a"]\x1b[0m will be created
  + resource "aws_subnet" "this" {
    }

  # aws_db_instance.main must be replaced
-/+ resource "aws_db_instance" "main" {
    }

  # aws_instance.old (deposed object 1a2b3c4d) will be destroyed
  - resource "aws_instance" "old" {
    }

  # aws_iam_role.a has moved to aws_iam_role.b
    resource "aws_iam_role" "b" {
    }

Plan: 1 to add, 1 to change, 2 to destroy.
"""


def test_parse_plan_resources():
    assert parse_plan_resources(PLAN_OUTPUT) == {
        "drift": ["aws_s3_bucket.logs"],
        "update": ["aws_instance.web"],
        "create": ['module.vpc.aws_subnet.this["eu central 1a"]'],
        "replace": ["aws_db_instance.main"],
        "destroy": ["aws_instance.old"],
        "move": ["aws_iam_role.a -> aws_iam_role.b"],
    }


def test_parse_plan_summary_includes_resources():
    summary = parse_plan_summary(PLAN_OUTPUT)

    assert summary is not None
    assert summary["add"] == 1
    assert summary["resources"]["create"] == ['module.vpc.aws_subnet.this["eu central 1a"]']
    assert "resources_truncated" not in summary


def test_parse_apply_summary_includes_resources():
    output = PLAN_OUTPUT + "\nApply complete! Resources: 1 added, 1 changed, 2 destroyed."

    summary = parse_apply_summary(output)

    assert summary is not None
    assert summary["added"] == 1
    assert summary["resources"]["replace"] == ["aws_db_instance.main"]


def test_parse_plan_summary_truncates_resources():
    output = "\n".join(f"  # null_resource.r[{i}] will be created" for i in range(MAX_RESOURCES_PER_ACTION + 5))
    output += "\nPlan: 205 to add, 0 to change, 0 to destroy."

    summary = parse_plan_summary(output)

    assert summary is not None
    assert len(summary["resources"]["create"]) == MAX_RESOURCES_PER_ACTION
    assert summary["resources_truncated"] is True
