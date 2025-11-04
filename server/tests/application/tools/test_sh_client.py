import os
import shutil
import tempfile

import pytest

from core.tools.shell_client import ShellScriptClient


@pytest.mark.asyncio
async def test_sh_client_with_string_args(mock_entity_logger):
    workspace = tempfile.mkdtemp()
    workspace_path = os.path.join(workspace, "fixtures/tf_fixtures")

    shutil.copytree(os.path.join(os.path.dirname(__file__), "fixtures/tf_fixtures"), workspace_path, dirs_exist_ok=True)

    environment_variables = {
        "TOKEN": "token",
        "ORG": "org",
    }

    sh_client = ShellScriptClient(
        command="ls",
        command_args="-la",
        environment_variables=environment_variables,
        workspace_path=workspace_path,
        logger=mock_entity_logger,
    )

    result = await sh_client.run_shell_command()

    assert "versions.tf" in result


@pytest.mark.asyncio
async def test_sh_client_with_list_args(mock_entity_logger):
    workspace = tempfile.mkdtemp()
    workspace_path = os.path.join(workspace, "fixtures/tf_fixtures")

    shutil.copytree(os.path.join(os.path.dirname(__file__), "fixtures/tf_fixtures"), workspace_path, dirs_exist_ok=True)

    environment_variables = {
        "TOKEN": "token",
        "ORG": "org",
    }

    sh_client = ShellScriptClient(
        command="ls",
        command_args=["-la"],
        environment_variables=environment_variables,
        workspace_path=workspace_path,
        logger=mock_entity_logger,
    )

    result = await sh_client.run_shell_command()

    assert "versions.tf" in result
