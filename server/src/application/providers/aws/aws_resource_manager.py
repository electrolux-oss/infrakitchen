import json
import os
from collections.abc import Callable
from typing import Any

import aiofiles

from core import CloudResourceAdapter

from .aws_client import AwsClient


class AwsResourceManager(CloudResourceAdapter):
    __cloud_resource_adapter_name__: str = "aws"

    def __init__(self, environment_variables: dict[str, str], **kwargs):
        super().__init__(environment_variables, **kwargs)
        self.environment_variables: dict[str, str] = environment_variables
        self.regions: str = kwargs.get("regions", ["us-east-1"])
        self.aws_client: Callable[..., AwsClient] = kwargs.get("aws_client", AwsClient)

    @staticmethod
    async def _get_schema() -> dict[str, Any]:
        schema_path = os.path.join(os.path.dirname(__file__), "resource_schema.json")

        if not os.path.exists(schema_path):
            raise FileNotFoundError(f"No such file or directory: '{schema_path}'")

        async with aiofiles.open(schema_path) as af:
            schema = await af.read()
            return json.loads(schema)

    async def metadata(self, resource_name: str, **kwargs) -> dict[str, Any] | list[dict[str, Any]]:
        """Get metadata about AWS resources."""
        schema = await self._get_schema()
        resource_schema = schema.get(resource_name, {})
        if not schema:
            raise ValueError(f"Resource {resource_name} not found in schema and cannot be scanned")

        name = kwargs.get("name")
        region = kwargs.get("region")
        if not name:
            raise ValueError("Resource name must be provided for metadata retrieval")

        if not region:
            raise ValueError("Resource region must be provided for metadata retrieval")

        session = self.aws_client(self.environment_variables).session

        if resource_schema.get("describe_function"):
            resource_data = await self.describe_resource(
                schema=resource_schema, session=session, region_name=region, **kwargs
            )
        elif resource_schema.get("list_function"):
            resource_data = await self.list_resources(schema=resource_schema, session=session, region_name=region)
        else:
            raise ValueError(f"No valid describe function found for resource schema: {resource_schema}")
        if not resource_data:
            raise ValueError(f"Resource {name} not found in region {region}")
        return resource_data

    @staticmethod
    async def list_resources(
        schema: dict[str, Any], session: Any, region_name: str, **kwargs: Any
    ) -> list[dict[str, Any]]:
        api_type = schema.get("api_type", "ec2")
        client = session.client(api_type, region_name=region_name)
        list_function = schema.get("list_function")
        list_function_args = schema.get("list_function_args", {})

        if not list_function:
            raise ValueError(f"No list function defined for resource schema: {schema}")

        async with client as aio_client:
            cloud_data = await getattr(aio_client, list_function)(
                **{k: v for k, v in kwargs.items() if k in list_function_args}
            )
            return cloud_data.get(schema["multiple"], [])

    @staticmethod
    async def describe_resource(
        schema: dict[str, Any], session: Any, region_name: str, **kwargs: Any
    ) -> dict[str, Any] | None:
        api_type = schema.get("api_type", "ec2")
        client = session.client(api_type, region_name=region_name)
        describe_function = schema.get("describe_function")
        describe_function_args = schema.get("describe_function_args", {})

        if not describe_function:
            raise ValueError(f"No describe function defined for resource schema: {schema}")

        async with client as aio_client:
            cloud_data = await getattr(aio_client, describe_function)(
                **{k: v for k, v in kwargs.items() if k in describe_function_args}
            )
            metadata = cloud_data.get(schema["single"], {})
            return metadata

    @classmethod
    async def get_resources(cls, **kwargs) -> list[str]:
        resources = await cls._get_schema()
        return list(resources.keys())
