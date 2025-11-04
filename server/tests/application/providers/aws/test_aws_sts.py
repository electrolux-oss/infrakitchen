# pyright: reportOptionalSubscript=false, reportArgumentType=false, reportTypedDictNotRequiredAccess=false
import pytest
from unittest.mock import Mock, AsyncMock

from application.providers import AwsSts
from botocore.exceptions import ClientError

from core.errors import AccessDenied


@pytest.fixture
def mock_env_variables():
    return {
        "AWS_ACCESS_KEY_ID": "access_key_id",
        "AWS_SECRET_ACCESS_KEY": "secret_access_key",
        "AWS_SESSION_TOKEN": "session_token",
        "AWS_ACCOUNT": "12345678",
    }


class TestGetCallerIdentity:
    @pytest.mark.asyncio
    async def test_get_caller_identity_without_response_metadata_success(self, monkeypatch, mock_env_variables):
        aws_sts = AwsSts(environment_variables=mock_env_variables)

        mock_sts = Mock()
        mock_sts.get_caller_identity = AsyncMock(return_value={"id": "caller_id", "ResponseMetadata": {"metadata": {}}})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_sts

        monkeypatch.setattr(AwsSts, "client", property(lambda self: mock_client_cm))

        result = await aws_sts.get_caller_identity()

        assert result["id"] == "caller_id"
        assert result.get("ResponseMetadata") is None

    @pytest.mark.asyncio
    async def test_get_caller_identity_access_denied(self, monkeypatch, mock_env_variables):
        aws_sts = AwsSts(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "AccessDeniedException", "Message": "Access denied"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="GetCallerIdentity")

        mock_sts = AsyncMock()
        mock_sts.get_caller_identity.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_sts

        monkeypatch.setattr(AwsSts, "client", property(lambda self: mock_client_cm))

        with pytest.raises(AccessDenied) as e:
            await aws_sts.get_caller_identity()

        assert (
            e.value.args[0]
            == "Access denied: An error occurred (AccessDeniedException) when calling the GetCallerIdentity operation: "
            "Access denied"
        )

    @pytest.mark.asyncio
    async def test_get_caller_identity_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_sts = AwsSts(environment_variables=mock_env_variables)

        mocked_exception = ValueError("Incorrect value")

        mock_sts = AsyncMock()
        mock_sts.get_caller_identity.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_sts

        monkeypatch.setattr(AwsSts, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ValueError) as e:
            await aws_sts.get_caller_identity()

        assert e.value.args[0] == "Incorrect value"
