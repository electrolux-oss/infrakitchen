from typing import Literal, cast
import aioboto3


class AwsClient:
    """
    Represents an AWS client for a specific AWS account and region.

    Args:
        aws_account (str): The AWS account ID.
        region (str, optional): The AWS region. Defaults to "us-east-1".
        api_type (str, optional): The type of AWS API to interact with. Defaults to "ec2".
        assumed_role_name (str, optional): The name of the assumed role. Defaults to None.
    """

    def __init__(
        self,
        environment_variables: dict[str, str],
        region: str | None = None,
        api_type: Literal[
            "ec2", "iam", "sts", "ecr", "s3", "dynamodb", "elasticache", "kafka", "eks", "account", "secretsmanager"
        ] = "ec2",
    ):
        self.aws_access_key_id: str | None = environment_variables.get("AWS_ACCESS_KEY_ID")
        self.aws_secret_access_key: str | None = environment_variables.get("AWS_SECRET_ACCESS_KEY")
        self.aws_session_token: str | None = environment_variables.get("AWS_SESSION_TOKEN")
        self.aws_account: str | None = environment_variables.get("AWS_ACCOUNT")
        self.aws_region: str = region or environment_variables.get("AWS_REGION", "us-east-1")

        if not self.aws_access_key_id or not self.aws_secret_access_key or not self.aws_account:
            raise ValueError("AWS credentials and account information must be provided in environment variables.")

        self.api_type = api_type

    @property
    def client(self):
        """
        Returns an AWS client object for the specified API type.

        Returns:
            botocore.client.BaseClient: The AWS client object.
        """
        return self.session.client(cast(Literal["xray"], self.api_type))

    @property
    def session(self):
        """
        Returns an AWS session object.

        Returns:
            aioboto3.Session: The AWS session object.
        """
        return aioboto3.Session(
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            aws_session_token=self.aws_session_token,
            region_name=self.aws_region,
        )


class AwsEC2Client(AwsClient):
    def __init__(self, environment_variables: dict[str, str], **kwargs):
        region = kwargs.get("region")
        super().__init__(environment_variables, region)


class AwsIAM(AwsClient):
    def __init__(self, environment_variables: dict[str, str], region: str):
        super().__init__(environment_variables, region, api_type="iam")


class AwsStsClient(AwsClient):
    def __init__(self, environment_variables: dict[str, str]):
        super().__init__(environment_variables, api_type="sts")


class AwsECR(AwsClient):
    def __init__(self, environment_variables: dict[str, str], region: str):
        super().__init__(environment_variables, region, api_type="ecr")


class AwsS3Client(AwsClient):
    def __init__(self, environment_variables: dict[str, str]):
        super().__init__(environment_variables, api_type="s3")


class AwsDynamoDbClient(AwsClient):
    def __init__(self, environment_variables: dict[str, str], region: str):
        super().__init__(environment_variables, region, api_type="dynamodb")


class AwsElasticacheClient(AwsClient):
    def __init__(self, environment_variables: dict[str, str], region: str):
        super().__init__(environment_variables, region, api_type="elasticache")


class AwsMskClient(AwsClient):
    def __init__(self, environment_variables: dict[str, str], region: str):
        super().__init__(environment_variables, region, api_type="kafka")


class AwsEksClient(AwsClient):
    def __init__(self, environment_variables: dict[str, str], region: str):
        super().__init__(environment_variables, region, api_type="eks")


class AwsAccountClient(AwsClient):
    def __init__(self, environment_variables: dict[str, str]):
        super().__init__(environment_variables, api_type="account")


class AwsSecretManagerClient(AwsClient):
    def __init__(self, environment_variables: dict[str, str], region: str):
        super().__init__(environment_variables, region, api_type="secretsmanager")
