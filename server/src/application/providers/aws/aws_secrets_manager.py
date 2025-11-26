from typing import Any

from botocore.exceptions import ClientError
from application.providers.aws.aws_client import AwsSecretManagerClient
from core.errors import EntityNotFound


class AwsSecretManager(AwsSecretManagerClient):
    def __init__(self, environment_variables: dict[str, Any], region: str):
        super().__init__(environment_variables, region)

    @classmethod
    def get_name(cls) -> str:
        return "aws_secrets_manager"

    async def get_secret(self, secret_name: str) -> str | bytes:
        async with self.client as sm:
            try:
                result = await sm.get_secret_value(SecretId=secret_name)
            except ClientError as e:
                error = e.response.get("Error", {})
                error_code = error.get("Code")
                match error_code:
                    case "ResourceNotFoundException":
                        raise EntityNotFound(f"The requested secret {secret_name} was not found") from e
                    case "InvalidRequestException":
                        raise ValueError(f"The request was invalid due to: {e}") from e
                    case "InvalidParameterException":
                        raise ValueError(f"The request had invalid params: {e}") from e
                    case "DecryptionFailure":
                        raise ValueError(f"The requested secret can't be decrypted: {e}") from e
                    case "InternalServiceError":
                        raise RuntimeError(f"An error occurred on the server side: {e}") from e
                    case _:
                        raise e
            else:
                # Secrets Manager decrypts the secret value using the associated KMS CMK
                # Depending on whether the secret was a string or binary, only one of these fields will be populated
                if "SecretString" in result:
                    return result["SecretString"]
                else:
                    return result["SecretBinary"]
