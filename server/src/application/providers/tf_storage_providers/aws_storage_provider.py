from typing import override

from core import StorageProviderAdapter
from core.custom_entity_log_controller import EntityLogger

from ...storages.model import AWSStorageConfig
from ..aws.aws_s3 import AwsS3


class AwsStorage:
    environment_variables: dict[str, str]
    configuration: AWSStorageConfig

    def __init__(self, logger: EntityLogger, **kwargs) -> None:
        self.logger: EntityLogger = logger
        self.environment_variables = kwargs.get("environment_variables", {})
        configuration = kwargs.get("configuration")

        if not isinstance(configuration, AWSStorageConfig):
            raise ValueError("No configuration provided for AWS backend provider.")
        self.configuration = configuration

        if not self.configuration.aws_bucket_name:
            raise ValueError("No bucket name provided for AWS backend provider.")

        if not self.configuration.aws_region:
            raise ValueError("No region provided for AWS backend provider.")

        # Setup region for AWS S3 client
        self.environment_variables["AWS_REGION"] = self.configuration.aws_region

        self.aws_s3_client = AwsS3(self.environment_variables)

    async def _create_aws_s3_bucket(self):
        self.logger.info("Creating AWS S3 bucket")
        bucket_name = self.configuration.aws_bucket_name
        bucket = await self.aws_s3_client.get_bucket(bucket_name)

        if not bucket:
            self.logger.info(f"AWS S3 bucket {bucket_name} not found")
            self.logger.info("Creating AWS S3 bucket")
            result = await self.aws_s3_client.create_bucket(bucket_name, region=self.configuration.aws_region)
            if result:
                self.logger.info(f"Created AWS S3 bucket {result}")
            else:
                self.logger.error(f"Failed to create AWS S3 bucket {result}")
                raise Exception(f"Failed to create AWS S3 bucket {result}")

            # Enable versioning for AWS S3 bucket
            self.logger.info("Enable versioning for AWS S3 bucket")
            _ = await self.aws_s3_client.put_bucket_versioning(bucket_name)
            self.logger.info("Updated versioning for AWS S3 bucket")

            # Enable server-side encryption for AWS S3 bucket
            self.logger.info("Enable server-side encryption for AWS S3 bucket")
            _ = await self.aws_s3_client.enable_encryption(
                bucket_name,
                rules=[
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256",
                        },
                        "BucketKeyEnabled": False,
                    },
                ],
            )
            self.logger.info("Updated server-side encryption for AWS S3 bucket")

            # Enable block public access for AWS S3 bucket
            self.logger.info("Attach encryption policy to AWS S3 bucket")
            _ = await self.aws_s3_client.put_bucket_policy(
                bucket_name,
                policy={
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "EnforceTlsRequestsOnly",
                            "Effect": "Deny",
                            "Principal": "*",
                            "Action": "s3:*",
                            "Resource": [f"arn:aws:s3:::{bucket_name}/*", f"arn:aws:s3:::{bucket_name}"],
                            "Condition": {"Bool": {"aws:SecureTransport": "false"}},
                        },
                        {
                            "Sid": "DenyIncorrectEncryptionHeader",
                            "Effect": "Deny",
                            "Principal": "*",
                            "Action": "s3:PutObject",
                            "Resource": f"arn:aws:s3:::{bucket_name}/*",
                            "Condition": {"StringNotEquals": {"s3:x-amz-server-side-encryption": "AES256"}},
                        },
                        {
                            "Sid": "DenyUnencryptedObjectUploads",
                            "Effect": "Deny",
                            "Principal": "*",
                            "Action": "s3:PutObject",
                            "Resource": f"arn:aws:s3:::{bucket_name}/*",
                            "Condition": {"Null": {"s3:x-amz-server-side-encryption": "true"}},
                        },
                    ],
                },
            )
            self.logger.info("Attached encryption policy to AWS S3 bucket")
        else:
            self.logger.info(f"AWS S3 bucket {bucket_name} already exists. Skipping creation...")

    async def _destroy_aws_s3_bucket(self):
        self.logger.info("Destroying AWS S3 bucket")
        bucket_name = self.configuration.aws_bucket_name
        bucket = await self.aws_s3_client.get_bucket(bucket_name)
        if bucket:
            self.logger.info(f"AWS S3 bucket {bucket_name} found")
            self.logger.info("Deleting AWS S3 bucket")
            await self.aws_s3_client.delete_bucket(bucket_name)
            self.logger.info(f"Deleted AWS S3 bucket {bucket_name}")
        else:
            self.logger.info(f"AWS S3 bucket {bucket_name} not found. Skipping deletion...")


class AwsTfStorage(StorageProviderAdapter, AwsStorage):
    __cloud_backend_provider_adapter_name__: str = "aws"

    def __init__(self, logger: EntityLogger, **kwargs) -> None:
        super().__init__(logger, **kwargs)

    @override
    async def create(self) -> None:
        await self._create_aws_s3_bucket()

    @override
    async def destroy(self) -> None:
        await self._destroy_aws_s3_bucket()
