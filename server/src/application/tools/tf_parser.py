import os
import re
from typing import Any

import aiofiles
import hcl2
from aiofiles.os import listdir, path


class HclVariableParser:
    """Parse HCL variable definitions."""

    VARIABLE_PATTERN = re.compile(r'^\s*variable\s+"([^"]+)"\s*\{')
    TYPE_PATTERN = re.compile(r"^\s*type\s*=")

    @staticmethod
    def extract_variable_types(tf_data: str) -> dict[str, str]:
        """Extract original variable types from raw HCL."""
        if not tf_data.strip():
            return {}

        lines = tf_data.splitlines()
        variables = {}
        i = 0

        while i < len(lines):
            line = lines[i]

            # Extract variable name and validate it's a proper variable declaration
            match = HclVariableParser.VARIABLE_PATTERN.match(line)
            if not match:
                i += 1
                continue

            var_name = match.group(1)

            # Find the variable block and extract type
            i, type_def = HclVariableParser._parse_variable_block(lines, i)
            if type_def:
                variables[var_name] = type_def

        return variables

    @staticmethod
    def _parse_variable_block(lines: list[str], start_idx: int) -> tuple[int, str | None]:
        """Parse a variable block and return the end index and type definition."""
        brace_count = 1 if "{" in lines[start_idx] else 0
        i = start_idx + 1
        type_def = None

        while i < len(lines) and brace_count > 0:
            line = lines[i]

            # Check for type definition
            if type_def is None and HclVariableParser.TYPE_PATTERN.match(line):
                type_def = HclVariableParser._extract_complete_type(lines, i)

            brace_count += line.count("{") - line.count("}")
            i += 1

        return i, type_def

    @staticmethod
    def _extract_complete_type(lines: list[str], type_line_idx: int) -> str:
        """Extract complete type definition, handling multi-line types."""
        line = lines[type_line_idx]
        type_value = line.split("=", 1)[1].strip()

        # Single-line type
        if not (type_value.endswith("{") or type_value.endswith("(")):
            return type_value

        # Multi-line type
        result = [type_value]
        brace_balance = type_value.count("{") + type_value.count("(") - type_value.count("}") - type_value.count(")")
        indent = 1

        for line in lines[type_line_idx + 1 :]:
            if brace_balance <= 0:
                break

            stripped = line.lstrip()
            if not stripped:
                continue

            # Handle indentation
            if stripped.startswith("}") or stripped.startswith(")"):
                indent = max(0, indent - 1)

            result.append("  " * indent + stripped)

            if stripped.endswith("{") or stripped.endswith("("):
                indent += 1

            brace_balance += line.count("{") + line.count("(") - line.count("}") - line.count(")")

        return "\n".join(result)


class OtfProvider:
    """Main class for handling OpenTofu/Terraform operations."""

    def __init__(self, workspace) -> None:
        self.workspace: str = workspace
        self.depth: int = 1  # Depth of the directory tree when adding files
        self.directory: str | None = None

    def parse_tf_to_json(self, tf_data: str) -> dict[str, Any]:
        dict_data: dict[str, Any] = hcl2.loads(tf_data)

        variables = dict_data.get("variable", [])
        if not variables:
            return dict_data

        original_types = HclVariableParser.extract_variable_types(tf_data)

        for variable in variables:
            for var_name, var_config in variable.items():
                if var_name in original_types:
                    var_config["original_type"] = original_types[var_name]

        return dict_data

    @staticmethod
    def list_to_dict(list_data: list[dict[str, Any]]) -> dict[str, Any]:
        result = {}
        for item in list_data:
            for key, value in item.items():
                result[key] = value
        return result

    @staticmethod
    def remap_variable_types(variables: dict[str, Any]) -> dict[str, Any]:
        # use JS types
        for _, value in variables.items():
            match value.get("type"):
                case "string":
                    value["type"] = "string"
                case "bool":
                    value["type"] = "boolean"
                case "number":
                    value["type"] = "number"
                case None:
                    value["type"] = "any"
                case _:
                    if "list(map" in value["type"]:
                        value["type"] = "array[object]"
                    elif "list(object" in value["type"]:
                        value["type"] = "array[object]"
                    elif "object(" in value["type"]:
                        value["type"] = "object"
                    elif "map(" in value["type"]:
                        value["type"] = "object"
                    elif "list(string" in value["type"]:
                        value["type"] = "array[string]"
                    else:
                        value["type"] = "any"
        return variables

    async def traverse_directories(self, files: list[str], directory: str | None = None, count: int = 0) -> None:
        """Recursively traverse all directories starting from 'directory'."""
        directory = directory or self.workspace
        for name in await listdir(directory):
            full_path = os.path.join(directory, name)
            if await path.isdir(full_path):
                if count < self.depth:
                    await self.traverse_directories(files, directory=full_path, count=count + 1)
            else:
                files.append(full_path)

    async def read_file_to_string(self, file_path: str) -> str:
        """Read a file's content into a string."""
        async with aiofiles.open(file_path) as file:
            data = await file.read()
        return data

    async def parse_tf_directory_to_json(self):
        """Parse all Terraform files in a given folder to JSON."""
        files: list[str] = []
        await self.traverse_directories(files, self.workspace)
        tf_data = ""
        for f in files:
            if not f.endswith(".tf"):
                continue
            tf_data += await self.read_file_to_string(f)
        return self.parse_tf_to_json(tf_data)

    async def setup_tf_backend(self, tf_data: dict[str, Any], integration_provider: str) -> None:
        terraform_config = self.list_to_dict(tf_data.get("terraform", []))
        backend_config = terraform_config.get("backend")

        if backend_config:
            return

        backend_tf_path = os.path.join(self.workspace, "ik_temp_backend.tf")
        if os.path.exists(backend_tf_path):
            raise FileExistsError(f"Backend file already exists: {backend_tf_path}")

        backend_content = get_backend_content(integration_provider)
        async with aiofiles.open(backend_tf_path, "w") as f:
            await f.write(backend_content)


def get_backend_content(integration_provider: str) -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    configs_dir = os.path.join(base_dir, "../utils/templates/tf_backends")
    if integration_provider == "aws":
        file_path = os.path.join(configs_dir, "backend_aws.tf")
    elif integration_provider == "gcp":
        file_path = os.path.join(configs_dir, "backend_gcp.tf")
    elif integration_provider == "azurerm":
        file_path = os.path.join(configs_dir, "backend_azurerm.tf")
    else:
        raise ValueError(f"Unsupported integration provider: {integration_provider}")

    with open(file_path) as f:
        return f.read()
