import tempfile
from unittest.mock import AsyncMock, Mock

import pytest

from application.tools import tf_client as tf_client_module
from application.tools.tf_client import OtfClient
from application.tools.tf_summary import MAX_RESOURCES_PER_ACTION

IN_SYNC_OUTPUT = "No changes. Your infrastructure still matches the configuration."
DRIFT_OUTPUT = """
OpenTofu detected the following changes made outside of OpenTofu since the last "tofu apply":

  # aws_s3_bucket.this has changed
  ~ resource "aws_s3_bucket" "this" {
      ~ tags = {}
    }

  # aws_iam_role.app has been deleted
  - resource "aws_iam_role" "app" {}

This is a refresh-only plan, so OpenTofu will not take any actions to undo these.
"""


def make_client(monkeypatch, output: str, mock_entity_logger) -> tuple[OtfClient, Mock]:
    shell_client = Mock()
    shell_client.return_value.run_shell_command = AsyncMock(return_value=output)
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
async def test_drift_check_runs_refresh_only_plan(monkeypatch, mock_entity_logger):
    client, shell_client = make_client(monkeypatch, IN_SYNC_OUTPUT, mock_entity_logger)

    result = await client.drift_check()

    assert result == {"drifted": False, "resources": []}
    assert shell_client.call_args.kwargs["command_args"].split()[:2] == ["plan", "-refresh-only"]


@pytest.mark.asyncio
async def test_drift_check_reports_drifted_resources(monkeypatch, mock_entity_logger):
    client, _ = make_client(monkeypatch, DRIFT_OUTPUT, mock_entity_logger)

    result = await client.drift_check()

    assert result["drifted"] is True
    assert result["resources"] == ["aws_s3_bucket.this", "aws_iam_role.app"]


@pytest.mark.asyncio
async def test_drift_check_truncates_huge_results(monkeypatch, mock_entity_logger):
    output = "\n".join(f"  # aws_s3_bucket.b{i} has changed" for i in range(MAX_RESOURCES_PER_ACTION + 5))
    client, _ = make_client(monkeypatch, output, mock_entity_logger)

    result = await client.drift_check()

    assert len(result["resources"]) == MAX_RESOURCES_PER_ACTION
    assert result["resources_truncated"] is True
