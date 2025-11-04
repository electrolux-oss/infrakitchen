# pyright: reportOptionalSubscript=false, reportArgumentType=false, reportTypedDictNotRequiredAccess=false
import pytest
from unittest.mock import Mock, AsyncMock

from application.providers import AwsDynamoDb
from botocore.exceptions import ClientError


@pytest.fixture
def mock_env_variables():
    return {
        "AWS_ACCESS_KEY_ID": "access_key_id",
        "AWS_SECRET_ACCESS_KEY": "secret_access_key",
        "AWS_SESSION_TOKEN": "session_token",
        "AWS_ACCOUNT": "12345678",
    }


class TestGetTable:
    @pytest.mark.asyncio
    async def test_get_table_success(self, monkeypatch, mock_env_variables):
        aws_dynamodb = AwsDynamoDb(environment_variables=mock_env_variables, region="eu-central-1")

        mock_dynamodb = Mock()
        mock_dynamodb.describe_table = AsyncMock(return_value={"name": "test_table"})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_dynamodb

        monkeypatch.setattr(AwsDynamoDb, "client", property(lambda self: mock_client_cm))

        result = await aws_dynamodb.get_table("test_table")

        assert result["name"] == "test_table"

    @pytest.mark.asyncio
    async def test_get_table_resource_not_found(self, monkeypatch, mock_env_variables):
        aws_dynamodb = AwsDynamoDb(environment_variables=mock_env_variables, region="eu-central-1")

        error_response = {"Error": {"Code": "ResourceNotFoundException", "Message": "Table not found"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="DescribeTable")

        mock_dynamodb = AsyncMock()
        mock_dynamodb.describe_table.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_dynamodb

        monkeypatch.setattr(AwsDynamoDb, "client", property(lambda self: mock_client_cm))

        result = await aws_dynamodb.get_table("test_table")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_table_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_dynamodb = AwsDynamoDb(environment_variables=mock_env_variables, region="eu-central-1")

        error_response = {"Error": {"Code": "AccessDeniedException", "Message": "Not authorize"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="DescribeTable")

        mock_dynamodb = AsyncMock()
        mock_dynamodb.describe_table.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_dynamodb

        monkeypatch.setattr(AwsDynamoDb, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_dynamodb.get_table("test_table")

        assert e.value.response["Error"]["Code"] == "AccessDeniedException"


class TestCreateTable:
    @pytest.mark.asyncio
    async def test_create_table_success(self, monkeypatch, mock_env_variables):
        aws_dynamodb = AwsDynamoDb(environment_variables=mock_env_variables, region="eu-central-1")

        mock_dynamodb = Mock()
        mock_dynamodb.create_table = AsyncMock(return_value={"TableDescription": {"name": "test_table"}})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_dynamodb

        monkeypatch.setattr(AwsDynamoDb, "client", property(lambda self: mock_client_cm))

        result = await aws_dynamodb.create_table(
            table_name="test_table", key_schema=[{}], attribute_definitions=[{}], provisioned_throughput={}
        )

        assert result["name"] == "test_table"

    @pytest.mark.asyncio
    async def test_create_table_without_table_description(self, monkeypatch, mock_env_variables):
        aws_dynamodb = AwsDynamoDb(environment_variables=mock_env_variables, region="eu-central-1")

        mock_dynamodb = Mock()
        mock_dynamodb.create_table = AsyncMock(return_value={"name": "test_table"})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_dynamodb

        monkeypatch.setattr(AwsDynamoDb, "client", property(lambda self: mock_client_cm))

        with pytest.raises(KeyError) as e:
            await aws_dynamodb.create_table(
                table_name="test_table", key_schema=[{}], attribute_definitions=[{}], provisioned_throughput={}
            )

        assert e.value.args[0] == "TableDescription"

    @pytest.mark.asyncio
    async def test_create_table_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_dynamodb = AwsDynamoDb(environment_variables=mock_env_variables, region="eu-central-1")

        error_response = {"Error": {"Code": "AccessDeniedException", "Message": "Not authorize"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="CreateTable")

        mock_dynamodb = AsyncMock()
        mock_dynamodb.create_table.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_dynamodb

        monkeypatch.setattr(AwsDynamoDb, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_dynamodb.create_table(
                table_name="test_table", key_schema=[{}], attribute_definitions=[{}], provisioned_throughput={}
            )

        assert e.value.response["Error"]["Code"] == "AccessDeniedException"


class TestDeleteTable:
    @pytest.mark.asyncio
    async def test_delete_table_success(self, monkeypatch, mock_env_variables):
        aws_dynamodb = AwsDynamoDb(environment_variables=mock_env_variables, region="eu-central-1")

        mock_dynamodb = Mock()
        mock_dynamodb.delete_table = AsyncMock()

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_dynamodb

        monkeypatch.setattr(AwsDynamoDb, "client", property(lambda self: mock_client_cm))

        await aws_dynamodb.delete_table("test_table")

        mock_dynamodb.delete_table.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_table_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_dynamodb = AwsDynamoDb(environment_variables=mock_env_variables, region="eu-central-1")

        error_response = {"Error": {"Code": "AccessDeniedException", "Message": "Not authorize"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="CreateTable")

        mock_dynamodb = AsyncMock()
        mock_dynamodb.delete_table.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_dynamodb

        monkeypatch.setattr(AwsDynamoDb, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_dynamodb.delete_table("test_table")

        assert e.value.response["Error"]["Code"] == "AccessDeniedException"
