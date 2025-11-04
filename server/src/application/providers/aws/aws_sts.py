from typing import Any
from core.errors import AccessDenied
from botocore.exceptions import ClientError

from .aws_client import AwsStsClient


class AwsSts(AwsStsClient):
    def __init__(self, environment_variables: dict[str, Any]):
        super().__init__(environment_variables)

    async def get_caller_identity(self) -> dict[str, Any]:
        """
        Returns a list of AWS regions.

        Returns:
            list: A list of AWS regions.
        """
        async with self.client as sts:
            try:
                response = await sts.get_caller_identity()
                del response["ResponseMetadata"]
                return response
            except ClientError as e:
                raise AccessDenied(f"Access denied: {e}") from e
