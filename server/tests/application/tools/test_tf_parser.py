import os
from unittest.mock import patch, AsyncMock

import pytest

from application.tools.tf_parser import OtfProvider

test_tf_data = """
resource "iam_user" "my-iam-user" {
    name = "iamuser"
}

output "hello_world" {
	value = "Hello, World!"
}

variable "account" {
  type = string
}

variable "region" {
  type = string
}

variable "name" {
  type = string
  default = "test"
}

variable "enabled" {
  type = bool
  default = false
}

variable "null_as_default" {
  type = string
  default = null
}

variable "parameters" {
  type = object({
    parameters = optional(list(any), [])
  })
  default = { "parameters" : [] }
}

variable "policy_access" {
  type = list(string)
  description = "List of policy access levels to be applied to the resource"
}

terraform {
  required_version = ">= 1.3.0"

  required_providers {

  }
}
"""


def test_parse_tf_to_json():
    tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")
    result = tf.parse_tf_to_json(test_tf_data)
    assert result["resource"][0]["iam_user"]["my-iam-user"]["name"] == "iamuser"
    assert result["output"][0]["hello_world"]["value"] == "Hello, World!"
    assert result["variable"][0]["account"]["type"] == "string"
    assert result["variable"][1]["region"]["type"] == "string"
    assert result["variable"][2]["name"]["type"] == "string"
    assert result["terraform"][0]["required_version"] == ">= 1.3.0"
    assert result["terraform"][0]["required_providers"] == [{}]


@pytest.mark.asyncio
async def test_read_folder():
    tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")
    result = await tf.parse_tf_directory_to_json()
    assert result["resource"][0]["iam_user"]["my-iam-user"]["name"] == "iamuser"
    assert isinstance(result["output"], list)
    assert isinstance(result["variable"], list)


@pytest.mark.asyncio
async def test_variables_configurations():
    tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")
    result = tf.parse_tf_to_json(test_tf_data)
    variables = result["variable"]
    variables_dict = tf.list_to_dict(variables)
    assert variables_dict["account"]["type"] == "string"
    assert variables_dict["account"]["original_type"] == "string"
    assert variables_dict["region"]["type"] == "string"
    assert variables_dict["region"]["original_type"] == "string"
    assert variables_dict["name"]["type"] == "string"
    assert variables_dict["name"]["default"] == "test"
    assert variables_dict["name"]["original_type"] == "string"
    assert variables_dict["parameters"]["type"] == '${object({"parameters": "${optional(list(any), [])}"})}'
    assert variables_dict["parameters"]["original_type"] == "object({\n  parameters = optional(list(any), [])\n})"
    assert variables_dict["parameters"]["default"] == {"parameters": []}

    # test remap_variable_types
    variables_dict = tf.remap_variable_types(variables_dict)
    assert variables_dict["account"]["type"] == "string"
    assert variables_dict["account"]["original_type"] == "string"
    assert variables_dict["region"]["type"] == "string"
    assert variables_dict["region"]["original_type"] == "string"
    assert variables_dict["enabled"]["type"] == "boolean"
    assert variables_dict["enabled"]["original_type"] == "bool"
    assert variables_dict["policy_access"]["type"] == "array[string]"
    assert variables_dict["policy_access"]["original_type"] == "list(string)"


class TestTraverseDirectories:
    @pytest.mark.asyncio
    async def test_travers_directories_with_depth_1(self, mock_resource_service):
        tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")
        files: list[str] = []

        await tf.traverse_directories(files=files)

        # file in /internal2 directory shouldn't be counted
        assert len(files) == 7


class AsyncMockFile:
    def __init__(self):
        self.write = AsyncMock()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass


class TestTfBackendSetup:
    @pytest.mark.asyncio
    async def test_setup_tf_backend_with_existing_backend_config(self):
        tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")

        tf_data_with_backend = {"terraform": [{"backend": {"s3": {"bucket": "my-bucket"}}}]}

        with patch("os.path.exists", return_value=False) as mock_open:
            # Should return early and not attempt to open/write a file
            await tf.setup_tf_backend(tf_data_with_backend, "aws")
            mock_open.assert_not_called()

    @pytest.mark.asyncio
    async def test_setup_tf_backend_creates_backend_file(self):
        tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")
        tf_data_no_backend = {"terraform": [{"required_version": ">= 1.3.0"}]}

        backend_tf_path = os.path.join(tf.workspace, "ik_temp_backend.tf")

        mock_file = AsyncMockFile()
        with (
            patch("os.path.exists", return_value=False),
            patch("aiofiles.open", return_value=mock_file) as mock_open,
        ):
            await tf.setup_tf_backend(tf_data_no_backend, "aws")
            mock_open.assert_called_once_with(backend_tf_path, "w")
            mock_file.write.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_setup_tf_backend_creates_backend_file_gcp(self):
        tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")
        tf_data_no_backend = {"terraform": [{"required_version": ">= 1.3.0"}]}

        backend_tf_path = os.path.join(tf.workspace, "ik_temp_backend.tf")

        mock_file = AsyncMockFile()
        with (
            patch("os.path.exists", return_value=False),
            patch("aiofiles.open", return_value=mock_file) as mock_open,
        ):
            await tf.setup_tf_backend(tf_data_no_backend, "gcp")
            mock_open.assert_called_once_with(backend_tf_path, "w")
            mock_file.write.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_setup_tf_backend_creates_backend_file_azurerm(self):
        tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")
        tf_data_no_backend = {"terraform": [{"required_version": ">= 1.3.0"}]}

        backend_tf_path = os.path.join(tf.workspace, "ik_temp_backend.tf")

        mock_file = AsyncMockFile()
        with (
            patch("os.path.exists", return_value=False),
            patch("aiofiles.open", return_value=mock_file) as mock_open,
        ):
            await tf.setup_tf_backend(tf_data_no_backend, "azurerm")
            mock_open.assert_called_once_with(backend_tf_path, "w")
            mock_file.write.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_setup_tf_backend_unsupported_provider(self):
        tf = OtfProvider("tests/application/tools/fixtures/tf_fixtures")
        tf_data_no_backend = {"terraform": [{"required_version": ">= 1.3.0"}]}

        with patch("os.path.exists", return_value=False):
            with pytest.raises(ValueError) as exc_info:
                await tf.setup_tf_backend(tf_data_no_backend, "newprovider")
            assert "provider" in str(exc_info.value).lower() or "unsupported" in str(exc_info.value).lower()
