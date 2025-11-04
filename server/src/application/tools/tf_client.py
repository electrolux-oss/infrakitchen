import json
import logging
import os
from typing import Any

import aiofiles

from core import EntityLogger
from core.errors import ShellExecutionError

from core.tools.shell_client import ShellScriptClient

logger = logging.getLogger(__name__)


class OtfClient:
    """
    Terraform/OpenTofu Client
    """

    def __init__(
        self,
        workspace_path: str,
        environment_variables: dict[str, str],
        variables: dict[str, Any],
        backend_storage_config: str,
        logger: EntityLogger,
    ):
        self.workspace_path: str = workspace_path
        self.environment_variables: dict[str, str] = environment_variables
        self.backend_storage_config: str = backend_storage_config
        self.logger: EntityLogger = logger
        self.variables: dict[str, Any] = variables

    async def init_tf_workspace(self):
        await self._generate_tfvar()
        await self._generate_backend_tfvar()

    async def _generate_tfvar(self):
        self.logger.info('Generate the "terraform.tfvars.json" file with all variables')
        async with aiofiles.open(os.path.join(self.workspace_path, "terraform.tfvars.json"), "w") as f:
            _ = await f.write(
                json.dumps(
                    (self.variables),
                    indent=2,
                )
            )

    async def _generate_backend_tfvar(self) -> None:
        """
        Generate backend.tfvars file.

        This method generates a backend.tfvars file based on the provided configuration.
        It writes the file to the specified resource directory and returns the filename.
        """
        self.logger.info("Generate backend.tfvars file")
        if not self.backend_storage_config:
            raise ValueError("backend_storage_config is required")

        async with aiofiles.open(os.path.join(self.workspace_path, "backend.tfvars"), "w") as f:
            await f.write(self.backend_storage_config)

        self.logger.info(
            f"Backend config generated. {self.backend_storage_config} File path is {self.workspace_path}/backend.tfvars"
        )

    async def _run_command(self, command_args) -> str:
        """
        Run Terraform command and print realtime output
        """

        self.logger.info(f"Running Tofu command: {command_args}")
        ssp = ShellScriptClient(
            command="tofu",
            command_args=command_args,
            workspace_path=self.workspace_path,
            environment_variables=self.environment_variables,
            logger=self.logger,
        )
        try:
            return await ssp.run_shell_command()
        except ShellExecutionError as e:
            raise ShellExecutionError(f"Tofu command {command_args} failed") from e

    async def init(self):
        """
        Initialize Terraform.

        This method initializes Terraform with the specified backend bucket.
        If no backend bucket is specified, Terraform is initialized without a backend.
        """
        self.logger.info("Initializing Tofu...")
        await self._run_command("init -force-copy -upgrade -reconfigure -backend-config=backend.tfvars")

    async def apply(self):
        """
        Apply Tofu configuration.
        """
        self.logger.info("Applying Tofu...")
        await self._run_command("apply -auto-approve=true")

    async def destroy(self):
        """
        Destroy Tofu configuration.
        """
        self.logger.info("Destroying Tofu...")
        await self._run_command("destroy -auto-approve=true")

    async def dry_run(self, destroy: bool = False):
        """
        Dry run Tofu configuration.
        """
        if destroy:
            self.logger.info("Planning Tofu destroy...")
            await self._run_command("plan -destroy")
        else:
            await self._run_command("plan")

    async def get_output(self) -> dict[str, Any]:
        """
        Get Tofu output.
        """
        result = await self._run_command("output -json")
        return json.loads(result)
