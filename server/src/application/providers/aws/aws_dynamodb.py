from typing import Any
from .aws_client import AwsDynamoDbClient
from botocore.exceptions import ClientError


class AwsDynamoDb(AwsDynamoDbClient):
    def __init__(self, environment_variables: dict[str, Any], region: str):
        super().__init__(environment_variables, region)

    async def get_table(self, table_name: str) -> dict[str, Any] | None:
        """
        Returns a table by name.

        Args:
            table_name (str): The name of the table.

        Returns:
            dict: The table.
        """
        async with self.client as dynamodb:
            try:
                return await dynamodb.describe_table(TableName=table_name)
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")
                if error_code == "ResourceNotFoundException":
                    return None
                raise

    async def create_table(
        self,
        table_name: str,
        key_schema: list[dict[str, Any]],
        attribute_definitions: list[dict[str, Any]],
        provisioned_throughput: dict[str, Any],
    ) -> dict[str, Any] | None:
        """
        Creates a table.

        Args:
            table_name (str): The name of the table.
            key_schema (list): The key schema.
            attribute_definitions (list): The attribute definitions.
            provisioned_throughput (dict): The provisioned throughput.
        """
        async with self.client as dynamodb:
            result = await dynamodb.create_table(
                TableName=table_name,
                KeySchema=key_schema,
                AttributeDefinitions=attribute_definitions,
                ProvisionedThroughput=provisioned_throughput,
            )
            return result["TableDescription"]

    async def delete_table(self, table_name: str) -> None:
        """
        Deletes a table.

        Args:
            table_name (str): The name of the table.
        """
        async with self.client as dynamodb:
            await dynamodb.delete_table(TableName=table_name)
