import json
from typing import Any, Literal
from botocore.exceptions import ClientError
from core.errors import AccessDenied
from .aws_client import AwsS3Client


class AwsS3(AwsS3Client):
    def __init__(self, environment_variables: dict[str, Any]):
        super().__init__(environment_variables)

    @classmethod
    def get_name(cls) -> str:
        return "aws_s3"

    async def get_buckets(self) -> list[dict[str, Any]]:
        """
        Returns a list of AWS regions.

        Returns:
            list: A list of AWS regions.
        """
        async with self.client as s3:
            try:
                result = await s3.list_buckets()
                return result["Buckets"]
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")
                if error_code == "AccessDeniedException":
                    raise AccessDenied(f"Access denied to list buckets: {e}") from e
                raise

    async def get_bucket(self, bucket_name: str) -> dict[str, Any] | None:
        """
        Returns a bucket by name.

        Args:
            bucket_name (str): The name of the bucket.

        Returns:
            dict: The bucket.
        """
        async with self.client as s3:
            try:
                return await s3.get_bucket_location(Bucket=bucket_name)
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")
                if error_code == "NoSuchBucket":
                    return None
                raise

    async def create_bucket(self, bucket_name: str, acl: str = "private", region="us-east-1") -> dict[str, Any] | None:
        """
        Creates a bucket.

        Args:
            bucket_name (str): The name of the bucket.
            acl (str, optional): The access control list. Defaults to "private".
            region (str, optional): The region of the bucket. Defaults to "us-east-1".
        """
        async with self.client as s3:
            if region == "us-east-1":
                # because of the implementation of AWS SDK,
                # when creating a bucket in us-east-1,
                # the LocationConstraint should not be provided
                # ref: https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateBucket.html#AmazonS3-CreateBucket-request-LocationConstraint
                result = await s3.create_bucket(ACL=acl, Bucket=bucket_name)
            else:
                result = await s3.create_bucket(
                    ACL=acl, Bucket=bucket_name, CreateBucketConfiguration={"LocationConstraint": region}
                )
            return result.get("Location")

    async def put_bucket_versioning(
        self, bucket_name: str, status: Literal["Enabled", "Suspended"] = "Enabled"
    ) -> dict[str, Any]:
        """
        Enables versioning on a bucket.

        Args:
            bucket_name (str): The name of the bucket.
            status (str, optional): The status of versioning. Defaults to "Enabled".
        """
        async with self.client as s3:
            return await s3.put_bucket_versioning(
                Bucket=bucket_name,
                VersioningConfiguration={
                    "Status": status,
                },
            )

    async def enable_encryption(self, bucket_name: str, rules: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Enables encryption on a bucket.

        Args:
            bucket_name (str): The name of the bucket.
        """
        async with self.client as s3:
            return await s3.put_bucket_encryption(
                Bucket=bucket_name, ServerSideEncryptionConfiguration={"Rules": rules}
            )

    async def put_bucket_policy(self, bucket_name: str, policy: dict[str, Any]) -> dict[str, Any]:
        """
        Puts a bucket policy.

        Args:
            bucket_name (str): The name of the bucket.
            policy (dict): The bucket policy.
        """
        async with self.client as s3:
            return await s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(policy))

    async def delete_bucket(self, bucket_name: str) -> None:
        """
        Deletes a bucket.

        Args:
            bucket_name (str): The name of the bucket.
        """
        async with self.client as s3:
            await s3.delete_bucket(Bucket=bucket_name)
