from unittest.mock import AsyncMock, Mock

import pytest
from botocore.exceptions import ClientError

from application.providers import AwsProvider, AwsSts
from application.providers.aws.aws_provider import AwsAuthentication
from core.errors import CloudWrongCredentials


async def get_account_session(self, region_name: str = "us-east-1"):
    self.environment_variables.update(
        {
            "AWS_ACCESS_KEY_ID": self.aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": self.aws_secret_access_key.get_decrypted_value(),
            "AWS_SESSION_TOKEN": "session",
            "AWS_ACCOUNT": self.aws_account,
        }
    )


AwsAuthentication.get_account_session = get_account_session


class TestIsValid:
    @pytest.mark.asyncio
    async def test_is_valid_success(self, monkeypatch):
        configuration = {
            "aws_access_key_id": "test_key",
            "aws_secret_access_key": "test_secret",
            "aws_account": "0123456789012",
            "aws_assumed_role_name": "test_role",
        }

        mock_sts = Mock()
        mock_sts.get_caller_identity = AsyncMock(return_value={"id": "caller_id", "ResponseMetadata": {"metadata": {}}})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_sts

        monkeypatch.setattr(AwsSts, "client", property(lambda self: mock_client_cm))

        provider = AwsProvider(configuration=configuration)
        await provider.authenticate()
        assert await provider.is_valid() is True

    @pytest.mark.asyncio
    async def test_is_valid_failure(self, monkeypatch):
        configuration = {
            "aws_access_key_id": "test_key",
            "aws_secret_access_key": "test_secret",
            "aws_account": "0123456789012",
            "aws_assumed_role_name": "test_role",
        }

        error_response = {"Error": {"Code": "AccessDeniedException", "Message": "Access denied"}}  # pyright: ignore[reportArgumentType]
        mocked_exception = ClientError(error_response=error_response, operation_name="GetCallerIdentity")  # pyright: ignore[reportArgumentType]

        mock_sts = AsyncMock()
        mock_sts.get_caller_identity.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_sts

        monkeypatch.setattr(AwsSts, "client", property(lambda self: mock_client_cm))

        provider = AwsProvider(configuration=configuration)
        await provider.authenticate()

        with pytest.raises(CloudWrongCredentials) as e:
            await provider.is_valid()

            expected_error_message = (
                "Failed to validate AWS connection: Access denied: An error occurred (AccessDeniedException) "
                "when calling the GetCallerIdentity operation: Access denied"
            )
            assert str(e.value) == expected_error_message
