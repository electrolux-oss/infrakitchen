import json
import os
import shutil
import tempfile
from typing import Any

import aiofiles
import pytest

from application.tools.tf_client import OtfClient


class TestOtfClient(OtfClient):
    __test__ = False

    def __init__(
        self,
        workspace_path: str,
        environment_variables: dict[str, str],
        variables: dict[str, Any],
        backend_storage_config: str,
        **kwargs,
    ):
        super().__init__(workspace_path, environment_variables, variables, backend_storage_config, **kwargs)

    async def init(self):
        pass

    async def apply(self, command_args: str = "-auto-approve=true"):
        pass

    async def destroy(self, command_args: str = "-auto-approve=true"):
        pass

    async def dry_run(self, command_args: str = "", destroy: bool = False):
        pass

    async def get_output(self) -> dict[str, Any]:
        return {
            "hello_world": {"sensitive": False, "type": "string", "value": "Hello, World!"},
            "network_id": {"sensitive": False, "type": "string", "value": "123456789"},
        }


@pytest.mark.asyncio
async def test_tf_client(mock_entity_logger):
    workspace = tempfile.mkdtemp()
    workspace_path = os.path.join(workspace, "fixtures/tf_fixtures")

    shutil.copytree(os.path.join(os.path.dirname(__file__), "fixtures/tf_fixtures"), workspace_path, dirs_exist_ok=True)

    environment_variables = {
        "TOKEN": "token",
        "ORG": "org",
    }

    variables = {
        "account": "account",
        "region": "eu-central-1",
        "name": "name",
    }

    backend_storage_config = """
    bucket = "tfstate-account-eu-central-1"
    region = "eu-central-1"
    use_lockfile = true
    key = "service-catalog/test_component/test_component/terraform.tfstate"
    encrypt = true
    """

    otf_client = TestOtfClient(
        workspace_path=workspace_path,
        environment_variables=environment_variables,
        variables=variables,
        backend_storage_config=backend_storage_config,
        logger=mock_entity_logger,
    )

    await otf_client.init_tf_workspace()

    async with aiofiles.open(os.path.join(otf_client.workspace_path, "terraform.tfvars.json")) as f:
        tfvar_data = await f.read()
        json_data = json.loads(tfvar_data)
        assert json_data["account"] == "account"
        assert json_data["region"] == "eu-central-1"
        assert json_data["name"] == "name"

    async with aiofiles.open(os.path.join(otf_client.workspace_path, "backend.tfvars")) as f:
        backend_config_data = await f.read()
        assert 'bucket = "tfstate-account-eu-central-1"' in backend_config_data
        assert 'region = "eu-central-1"' in backend_config_data
        assert "use_lockfile = true" in backend_config_data
        assert 'key = "service-catalog/test_component/test_component/terraform.tfstate"' in backend_config_data
        assert "encrypt = true" in backend_config_data

    await otf_client.init()
    await otf_client.dry_run()
    await otf_client.apply()

    output = await otf_client.get_output()
    assert isinstance(output, dict)
    assert "hello_world" in output
    assert output["hello_world"]["value"] == "Hello, World!"
    assert output["network_id"]["value"] == "123456789"

    shutil.rmtree(workspace, ignore_errors=True)
