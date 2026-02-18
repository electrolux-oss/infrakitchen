import base64
import logging
import re
from typing import Any, override

import aiofiles
import botocore.exceptions
from aiobotocore.hooks import AioHierarchicalEmitter
from aiobotocore.session import get_session
from aiobotocore.signers import AioRequestSigner
from aiofiles import tempfile
from kubernetes_asyncio.client import Configuration

from core.adapters.provider_adapters import IntegrationProvider
from core.caches.functions import cache_decorator
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials, AccessDenied
from core.models.encrypted_secret import EncryptedSecretStr
from core.tools.kubernetes_client import KubernetesClient
from .aws_sts import AwsSts
from ...integrations.schema import AWSIntegrationConfig

log = logging.getLogger("aws_provider")


class AwsAuthentication:
    logger: logging.Logger | EntityLogger = log
    workspace_root: str | None = None
    """
    Represents AWS role-based authentication.

    Args:
        kwargs (dict): The keyword arguments.

    Attributes:
        aws_assumed_role_name (str): The name of the assumed role.
        aws_account (str): The AWS account ID.
        aws_access_key (str): The AWS IDP access key ID.
        aws_access_secret (str): The AWS IDP secret access key.
        aws_access_key_id (str): The AWS access key ID obtained after assuming the role.
        aws_secret_access_key (str): The AWS secret access key obtained after assuming the role.
        aws_session_token (str): The AWS session token obtained after assuming the role.
    """

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log

        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for AwsRoleAuthentication")
        configuration = AWSIntegrationConfig.model_validate(config)
        self.aws_assumed_role_name: str | None = configuration.aws_assumed_role_name
        self.aws_account: str | None = configuration.aws_account
        self.aws_access_key_id: str | None = configuration.aws_access_key_id
        self.aws_secret_access_key: EncryptedSecretStr = configuration.aws_secret_access_key
        self.aws_session_duration: int = configuration.aws_session_duration or 3600
        self.aws_default_region: str = configuration.aws_default_region or "us-east-1"
        self.environment_variables: dict[str, str | Any] = kwargs.get("environment_variables", {})
        if not (self.aws_access_key_id and self.aws_secret_access_key and self.aws_account):
            raise CloudWrongCredentials("Some AWS configs are missed")

    async def get_account_session(self):
        if self.aws_assumed_role_name is None or self.aws_assumed_role_name.strip() == "":
            self.logger.info("No role to assume, using provided AWS credentials directly.")
            self.environment_variables.update(
                {
                    "AWS_ACCESS_KEY_ID": self.aws_access_key_id,
                    "AWS_SECRET_ACCESS_KEY": self.aws_secret_access_key.get_decrypted_value(),
                    "AWS_ACCOUNT": self.aws_account,
                    "AWS_REGION": self.aws_default_region,
                }
            )
            return

        try:
            async with get_session().create_client(
                "sts",
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key.get_decrypted_value()
                if self.aws_secret_access_key
                else None,
            ) as aio_sts_client:
                assumed_role_object: dict[str, Any] = await aio_sts_client.assume_role(
                    # pyright: ignore[reportGeneralTypeIssues]
                    RoleArn=f"arn:aws:iam::{self.aws_account}:role/{self.aws_assumed_role_name}",
                    RoleSessionName="InfraKitchenSession",
                    DurationSeconds=self.aws_session_duration,
                )

                credentials: dict[str, str] = assumed_role_object["Credentials"]
                self.environment_variables.update(
                    {
                        "AWS_ACCESS_KEY_ID": credentials["AccessKeyId"],
                        "AWS_SECRET_ACCESS_KEY": credentials["SecretAccessKey"],
                        "AWS_SESSION_TOKEN": credentials["SessionToken"],
                        "AWS_ACCOUNT": self.aws_account,
                        "AWS_REGION": self.aws_default_region,
                    }
                )
                self.logger.info(
                    f"Fetched credentials for AWS Account: {self.aws_account} AssumedRole: {self.aws_assumed_role_name}"
                )

        except botocore.exceptions.ClientError as e:
            if "InvalidClientTokenId" in str(e) or "AccessDenied" in str(e):
                raise CloudWrongCredentials(
                    "Invalid AWS credentials or InfraKitchen does not have access to this AWS account or role."
                ) from e
            self.logger.error(f"Failed to assume role: {e}")
            raise CloudWrongCredentials(f"Failed to assume role: {e}") from e
        except Exception as e:
            self.logger.error(f"An unexpected error occurred during role assumption: {e}")
            raise


class AwsProvider(IntegrationProvider, AwsAuthentication):
    __integration_provider_name__: str = "aws"
    __integration_provider_type__: str = "cloud"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        _ = await self.get_account_session()

    @cache_decorator(ttl=300)  # Cache for 5 minutes
    async def get_bearer_token(self, cluster_arn: str) -> str:
        """Generate a bearer token for Kubernetes authentication using AWS STS.
        Account ID and region will be taken from the ARN.
        Args:
            cluster_arn (str): The ARN of the Kubernetes cluster.
        Returns:
            str: The generated bearer token.
        """

        arn_parts = cluster_arn.split(":")
        if len(arn_parts) < 6 or not arn_parts[5].startswith("cluster/"):
            raise ValueError(f"Invalid EKS cluster ARN format: {cluster_arn}")

        region = arn_parts[3]
        cluster_name = arn_parts[5].split("/")[-1]

        STS_TOKEN_EXPIRES_IN = 60

        if not self.environment_variables.get("AWS_ACCESS_KEY_ID") or not self.environment_variables.get(
            "AWS_SECRET_ACCESS_KEY"
        ):
            await self.get_account_session()

        assumed_role_session = get_session()
        assumed_role_session.set_credentials(
            access_key=self.environment_variables["AWS_ACCESS_KEY_ID"],
            secret_key=self.environment_variables["AWS_SECRET_ACCESS_KEY"],
            token=self.environment_variables["AWS_SESSION_TOKEN"],
        )

        if not await assumed_role_session.get_credentials():
            raise RuntimeError("AWS session credentials are not set. Call get_account_session first.")

        async with assumed_role_session.create_client("sts", region_name=region) as temp_sts_client:
            service_id_object = temp_sts_client.meta.service_model.service_id

            credentials = await assumed_role_session.get_credentials()
            emitter = AioHierarchicalEmitter()

            signer = AioRequestSigner(
                service_id_object,
                region,
                "sts",
                "v4",
                credentials,
                emitter,
            )

            params = {
                "method": "GET",
                "url": f"https://sts.{region}.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15",
                "body": {},
                "headers": {"x-k8s-aws-id": cluster_name},
                "context": {},
            }

            signed_url = await signer.generate_presigned_url(
                params,
                region_name=region,
                expires_in=STS_TOKEN_EXPIRES_IN,
                operation_name="",
            )

            base64_url = base64.urlsafe_b64encode(signed_url.encode("utf-8")).decode("utf-8")
            return "k8s-aws-v1." + re.sub(r"=*", "", base64_url)

    @staticmethod
    async def _write_cafile(data: str) -> str:
        """Save the CA file for Kubernetes client.
        Args:
            data (str): Base64 encoded CA data.
        Returns:
            FileDescriptorOrPath: Path to the temporary CA file.
        """

        async with tempfile.NamedTemporaryFile(mode="w+b", delete=False) as temp_file:
            cafile_path = temp_file.name

        cadata = base64.b64decode(data)
        async with aiofiles.open(cafile_path, mode="wb") as afp:
            _ = await afp.write(cadata)
        return str(cafile_path)

    @override
    async def get_kubernetes_client(self, cluster_metadata: dict[str, Any]) -> KubernetesClient:
        configuration = Configuration()
        if not cluster_metadata:
            raise ValueError("Cluster metadata is required to create Kubernetes client")

        cafile_path = await self._write_cafile(cluster_metadata["certificateAuthority"]["data"])
        bearer_token = await self.get_bearer_token(cluster_metadata["arn"])
        configuration.api_key["BearerToken"] = bearer_token
        configuration.api_key_prefix["BearerToken"] = "Bearer"  # pyright: ignore[reportIndexIssue]
        configuration.host = cluster_metadata["endpoint"]
        configuration.ssl_ca_cert = cafile_path

        return KubernetesClient(configuration)

    @override
    async def is_valid(self) -> bool:
        try:
            sts_client = AwsSts(self.environment_variables)
            return await sts_client.get_caller_identity() is not None
        except AccessDenied as e:
            raise CloudWrongCredentials(
                "Failed to validate AWS connection", metadata=[{"cloud_message": str(e)}]
            ) from e
