# pyright: reportOptionalSubscript=false, reportArgumentType=false, reportTypedDictNotRequiredAccess=false
import pytest
from unittest.mock import Mock, AsyncMock

from application.providers import AwsS3
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


class TestGetBuckets:
    @pytest.mark.asyncio
    async def test_get_buckets_success(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.list_buckets = AsyncMock(return_value={"Buckets": [{"name": "bucket_name"}]})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.get_buckets()

        assert result[0]["name"] == "bucket_name"

    @pytest.mark.asyncio
    async def test_get_buckets_access_denied(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "AccessDeniedException", "Message": "Access denied"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="ListBuckets")

        mock_s3 = AsyncMock()
        mock_s3.list_buckets.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        with pytest.raises(AccessDenied) as e:
            await aws_s3.get_buckets()

        assert (
            e.value.args[0] == "Access denied to list buckets: An error occurred (AccessDeniedException) "
            "when calling the ListBuckets operation: Access denied"
        )

    @pytest.mark.asyncio
    async def test_get_buckets_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "UnexpectedException", "Message": "Something went wrong"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="ListBuckets")

        mock_s3 = AsyncMock()
        mock_s3.list_buckets.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_s3.get_buckets()

        assert e.value.response["Error"]["Code"] == "UnexpectedException"


class TestGetBucket:
    @pytest.mark.asyncio
    async def test_get_bucket_success(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.get_bucket_location = AsyncMock(return_value={"name": "bucket_name"})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.get_bucket("bucket_name")

        assert result["name"] == "bucket_name"

    @pytest.mark.asyncio
    async def test_get_bucket_does_not_exist(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "NoSuchBucket", "Message": "Bucket doesn't exist"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="GetBucketLocation")

        mock_s3 = AsyncMock()
        mock_s3.get_bucket_location.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.get_bucket("bucket_name")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_bucket_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "UnexpectedException", "Message": "Something went wrong"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="ListBuckets")

        mock_s3 = AsyncMock()
        mock_s3.get_bucket_location.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_s3.get_bucket("bucket_name")

        assert e.value.response["Error"]["Code"] == "UnexpectedException"


class TestCreateBucket:
    @pytest.mark.asyncio
    async def test_create_bucket_success(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.create_bucket = AsyncMock(return_value={"Location": {"name": "bucket_name"}})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.create_bucket(bucket_name="bucket_name")

        assert result["name"] == "bucket_name"

        mock_s3.create_bucket.assert_awaited_with(ACL="private", Bucket="bucket_name")

    @pytest.mark.asyncio
    async def test_create_bucket_in_specific_region(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.create_bucket = AsyncMock(return_value={"Location": {"name": "bucket_name"}})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.create_bucket(bucket_name="bucket_name", region="eu-central-1")

        assert result["name"] == "bucket_name"

        mock_s3.create_bucket.assert_awaited_with(
            ACL="private", Bucket="bucket_name", CreateBucketConfiguration={"LocationConstraint": "eu-central-1"}
        )

    @pytest.mark.asyncio
    async def test_create_bucket_without_location(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.create_bucket = AsyncMock(return_value={"name": "bucket_name"})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.create_bucket(bucket_name="bucket_name")

        assert result is None

    @pytest.mark.asyncio
    async def test_create_bucket_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "UnexpectedException", "Message": "Something went wrong"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="CreateBucket")

        mock_s3 = AsyncMock()
        mock_s3.create_bucket.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_s3.create_bucket(bucket_name="bucket_name")

        assert e.value.response["Error"]["Code"] == "UnexpectedException"


class TestPutBucketVersioning:
    @pytest.mark.asyncio
    async def test_put_bucket_versioning_success(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.put_bucket_versioning = AsyncMock(return_value={"name": "bucket_name"})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.put_bucket_versioning(bucket_name="bucket_name")

        assert result["name"] == "bucket_name"

        mock_s3.put_bucket_versioning.assert_awaited_with(
            Bucket="bucket_name", VersioningConfiguration={"Status": "Enabled"}
        )

    @pytest.mark.asyncio
    async def test_put_bucket_versioning_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "UnexpectedException", "Message": "Something went wrong"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="PutBucketVersioning")

        mock_s3 = AsyncMock()
        mock_s3.put_bucket_versioning.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_s3.put_bucket_versioning(bucket_name="bucket_name")

        assert e.value.response["Error"]["Code"] == "UnexpectedException"


class TestEnableEncryption:
    @pytest.mark.asyncio
    async def test_enable_encryption_success(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.put_bucket_encryption = AsyncMock(return_value={"name": "bucket_name"})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.enable_encryption(bucket_name="bucket_name", rules=[{"name": "rule_name"}])

        assert result["name"] == "bucket_name"

        mock_s3.put_bucket_encryption.assert_awaited_with(
            Bucket="bucket_name", ServerSideEncryptionConfiguration={"Rules": [{"name": "rule_name"}]}
        )

    @pytest.mark.asyncio
    async def test_enable_encryption_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "UnexpectedException", "Message": "Something went wrong"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="PutBucketEncryption")

        mock_s3 = AsyncMock()
        mock_s3.put_bucket_encryption.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_s3.enable_encryption(bucket_name="bucket_name", rules=[{"name": "rule_name"}])

        assert e.value.response["Error"]["Code"] == "UnexpectedException"


class TestPutBucketPolicy:
    @pytest.mark.asyncio
    async def test_put_bucket_policy_success(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.put_bucket_policy = AsyncMock(return_value={"name": "bucket_name"})

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        result = await aws_s3.put_bucket_policy(bucket_name="bucket_name", policy={"name": "policy_name"})

        assert result["name"] == "bucket_name"

        mock_s3.put_bucket_policy.assert_awaited_with(Bucket="bucket_name", Policy='{"name": "policy_name"}')

    @pytest.mark.asyncio
    async def test_put_bucket_policy_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "UnexpectedException", "Message": "Something went wrong"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="PutBucketPolicy")

        mock_s3 = AsyncMock()
        mock_s3.put_bucket_policy.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_s3.put_bucket_policy(bucket_name="bucket_name", policy={"name": "policy_name"})

        assert e.value.response["Error"]["Code"] == "UnexpectedException"


class TestDeleteBucket:
    @pytest.mark.asyncio
    async def test_delete_bucket_success(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        mock_s3 = Mock()
        mock_s3.delete_bucket = AsyncMock()

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        await aws_s3.delete_bucket(bucket_name="bucket_name")

        mock_s3.delete_bucket.assert_awaited_with(Bucket="bucket_name")

    @pytest.mark.asyncio
    async def test_delete_bucket_unexpected_client_error(self, monkeypatch, mock_env_variables):
        aws_s3 = AwsS3(environment_variables=mock_env_variables)

        error_response = {"Error": {"Code": "UnexpectedException", "Message": "Something went wrong"}}
        mocked_exception = ClientError(error_response=error_response, operation_name="DeleteBucket")

        mock_s3 = AsyncMock()
        mock_s3.delete_bucket.side_effect = mocked_exception

        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__.return_value = mock_s3

        monkeypatch.setattr(AwsS3, "client", property(lambda self: mock_client_cm))

        with pytest.raises(ClientError) as e:
            await aws_s3.delete_bucket(bucket_name="bucket_name")

        assert e.value.response["Error"]["Code"] == "UnexpectedException"
