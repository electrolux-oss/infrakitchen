from unittest.mock import AsyncMock, MagicMock
import uuid
import pytest

from core.casbin.enforcer import CasbinEnforcer


class TestCasbinEnforcer:
    mock_adapter: MagicMock = MagicMock()
    mock_rabbitmq: MagicMock = MagicMock()
    enforcer: CasbinEnforcer  # pyright: ignore[reportUninitializedInstanceVariable]

    def setup_method(self):
        self.mock_adapter = MagicMock()
        self.mock_rabbitmq = MagicMock()
        self.mock_rabbitmq.send_task = AsyncMock()

        # Create a new instance each time to avoid singleton side effects
        CasbinEnforcer._instances.clear()
        self.enforcer = CasbinEnforcer(adapter=self.mock_adapter, rabbitmq=self.mock_rabbitmq)

    @pytest.mark.asyncio
    async def test_init_enforcer(self, monkeypatch):
        # Fake casbin.AsyncEnforcer
        fake_enforcer = MagicMock()
        fake_enforcer.load_policy = AsyncMock()
        fake_enforcer.get_policy.return_value = [["alice", "data", "read"]]

        # Mock constructor to return fake_enforcer
        class FakeAsyncEnforcer:
            def __init__(self, *args, **kwargs):
                pass

            async def load_policy(self):
                return await fake_enforcer.load_policy()

            def get_policy(self):
                return fake_enforcer.get_policy()

        monkeypatch.setattr("casbin.AsyncEnforcer", FakeAsyncEnforcer)
        assert self.enforcer is not None, "Enforcer should be None before initialization"
        assert self.enforcer.enforcer is None, "Enforcer should be None before initialization"

        await self.enforcer.init_enforcer()

        fake_enforcer.load_policy.assert_awaited_once()
        fake_enforcer.get_policy.assert_called_once()
        assert self.enforcer.enforcer is not None, "Enforcer should be initialized"
        assert self.enforcer.enforcer.get_policy() == [["alice", "data", "read"]], "Policy should match expected value"
        assert await self.enforcer.get_enforcer() is self.enforcer.enforcer, (
            "get_enforcer should return the initialized enforcer"
        )


class TestAddCasbinPolicy:
    mock_adapter: MagicMock = MagicMock()
    mock_rabbitmq: MagicMock = MagicMock()
    mock_enforcer = AsyncMock()
    enforcer: CasbinEnforcer  # pyright: ignore[reportUninitializedInstanceVariable]

    def setup_method(self):
        self.mock_adapter = MagicMock()
        self.mock_rabbitmq = MagicMock()
        self.mock_rabbitmq.send_task = AsyncMock()

        # Create a new instance each time to avoid singleton side effects
        CasbinEnforcer._instances.clear()
        self.enforcer = CasbinEnforcer(adapter=self.mock_adapter, rabbitmq=self.mock_rabbitmq)

    @pytest.mark.asyncio
    async def test_add_casbin_policy_success(self, monkeypatch):
        mock_enforcer = AsyncMock()
        mock_enforcer.add_policy.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)
        self.enforcer.send_reload_event = AsyncMock()

        # Inputs
        subject = "alice"
        object_id = uuid.uuid4()
        action = "read"
        object_type = "resource"

        await self.enforcer.add_casbin_policy(subject, object_id, action, object_type)

        expected_object_id = f"{object_type}:{object_id}"

        mock_enforcer.add_policy.assert_awaited_once_with(subject, expected_object_id, action)
        self.enforcer.send_reload_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_add_casbin_policy_invalid_subject(self):
        mock_enforcer = AsyncMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        subject = "Invalid-Subject"  # contains dash, should fail
        object_id = uuid.uuid4()

        with pytest.raises(ValueError, match=r"Subject must be a string of lowercase letters"):
            await self.enforcer.add_casbin_policy(subject, object_id)

    @pytest.mark.asyncio
    async def test_add_casbin_policy_invalid_object(self):
        mock_enforcer = AsyncMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        subject = "valid_subject"
        object_id = 12345  # invalid type

        with pytest.raises(ValueError, match=r"Casbin object must be a string or UUID"):
            await self.enforcer.add_casbin_policy(subject, object_id)  # pyright: ignore[reportArgumentType]

    @pytest.mark.asyncio
    async def test_add_casbin_policy_no_reload(self):
        mock_enforcer = AsyncMock()
        mock_enforcer.add_policy.return_value = True

        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)
        self.enforcer.send_reload_event = AsyncMock()

        subject = "alice"
        object_id = "sensitive"
        action = "write"
        object_type = "dataset"

        await self.enforcer.add_casbin_policy(subject, object_id, action, object_type, send_reload_event=False)

        mock_enforcer.add_policy.assert_awaited_once()
        self.enforcer.send_reload_event.assert_not_awaited()


class TestAddCasbinUserPolicy:
    mock_adapter: MagicMock = MagicMock()
    mock_rabbitmq: MagicMock = MagicMock()
    mock_enforcer = AsyncMock()
    enforcer: CasbinEnforcer  # pyright: ignore[reportUninitializedInstanceVariable]

    def setup_method(self):
        self.mock_adapter = MagicMock()
        self.mock_rabbitmq = MagicMock()
        self.mock_rabbitmq.send_task = AsyncMock()

        CasbinEnforcer._instances.clear()
        self.enforcer = CasbinEnforcer(adapter=self.mock_adapter, rabbitmq=self.mock_rabbitmq)

    async def test_add_user_policy_success_with_uuid_object(self):
        mock_enforcer = AsyncMock()
        mock_enforcer.add_policy.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)
        self.enforcer.send_reload_event = AsyncMock()

        user_id = uuid.uuid4()
        object_id = uuid.uuid4()
        action = "read"
        object_type = "dataset"

        await self.enforcer.add_casbin_user_policy(user_id, object_id, action, object_type)

        expected_subject = f"user:{user_id}"
        expected_object = f"{object_type}:{object_id}"
        mock_enforcer.add_policy.assert_awaited_once_with(expected_subject, expected_object, action)
        self.enforcer.send_reload_event.assert_awaited_once()

    async def test_add_user_policy_success_with_str_object(self):
        mock_enforcer = AsyncMock()
        mock_enforcer.add_policy.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)
        self.enforcer.send_reload_event = AsyncMock()

        user_id = uuid.uuid4()
        object_id = "my_dataset"
        action = "write"
        object_type = "dataset"

        await self.enforcer.add_casbin_user_policy(user_id, object_id, action, object_type)

        expected_subject = f"user:{user_id}"
        expected_object = f"{object_type}:{object_id}"
        mock_enforcer.add_policy.assert_awaited_once_with(expected_subject, expected_object, action)
        self.enforcer.send_reload_event.assert_awaited_once()

    async def test_add_user_policy_invalid_user_id(self):
        mock_enforcer = AsyncMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = "not-a-uuid"
        object_id = uuid.uuid4()
        with pytest.raises(ValueError, match="User ID must be a UUID"):
            await self.enforcer.add_casbin_user_policy(user_id, object_id)

    async def test_add_user_policy_invalid_object_type(self):
        mock_enforcer = AsyncMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = uuid.uuid4()
        object_id = 12345  # Not a valid UUID or str

        with pytest.raises(ValueError, match="Casbin object must be a string or UUID"):
            await self.enforcer.add_casbin_user_policy(user_id, object_id)  # pyright: ignore[reportArgumentType]

    async def test_add_user_policy_invalid_str_object_format(self):
        mock_enforcer = AsyncMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = uuid.uuid4()
        object_id = "INVALID#OBJECT"

        with pytest.raises(ValueError, match="Object must be a string of lowercase letters and"):
            await self.enforcer.add_casbin_user_policy(user_id, object_id)

    async def test_add_user_policy_no_reload(self):
        mock_enforcer = AsyncMock()
        mock_enforcer.add_policy.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)
        self.enforcer.send_reload_event = AsyncMock()

        user_id = uuid.uuid4()
        object_id = uuid.uuid4()
        action = "read"

        await self.enforcer.add_casbin_user_policy(user_id, object_id, action, send_reload_event=False)

        expected_subject = f"user:{user_id}"
        expected_object = f"resource:{object_id}"
        mock_enforcer.add_policy.assert_awaited_once_with(expected_subject, expected_object, action)
        self.enforcer.send_reload_event.assert_not_awaited()


@pytest.mark.asyncio
class TestAddCasbinUserRole:
    mock_adapter: MagicMock = MagicMock()
    mock_rabbitmq: MagicMock = MagicMock()
    mock_enforcer = AsyncMock()
    enforcer: CasbinEnforcer  # pyright: ignore[reportUninitializedInstanceVariable]

    def setup_method(self):
        self.mock_adapter = MagicMock()
        self.mock_rabbitmq = MagicMock()
        self.mock_rabbitmq.send_task = AsyncMock()

        CasbinEnforcer._instances.clear()
        self.enforcer = CasbinEnforcer(adapter=self.mock_adapter, rabbitmq=self.mock_rabbitmq)

    async def test_add_user_role_success_uuid(self):
        mock_enforcer = AsyncMock()
        mock_enforcer.add_role_for_user.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)
        self.enforcer.send_reload_event = AsyncMock()

        user_id = uuid.uuid4()
        object_id = uuid.uuid4()
        object_type = "dataset"

        result = await self.enforcer.add_casbin_user_role(user_id, object_id, object_type)

        expected_subject = f"user:{user_id}"
        expected_object = f"{object_type}:{object_id}"

        mock_enforcer.add_role_for_user.assert_awaited_once_with(expected_subject, expected_object)
        self.enforcer.send_reload_event.assert_awaited_once()
        assert result is True

    async def test_add_user_role_success_string_object(self):
        mock_enforcer = AsyncMock()
        mock_enforcer.add_role_for_user.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)
        self.enforcer.send_reload_event = AsyncMock()

        user_id = uuid.uuid4()
        object_id = "my_resource"
        object_type = "resource"

        result = await self.enforcer.add_casbin_user_role(user_id, object_id, object_type)
        assert result is True
        expected_subject = f"user:{user_id}"
        expected_object = f"{object_type}:{object_id}"

        mock_enforcer.add_role_for_user.assert_awaited_once_with(expected_subject, expected_object)
        self.enforcer.send_reload_event.assert_awaited_once()

    async def test_add_user_role_invalid_user_id(self):
        mock_enforcer = AsyncMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = "not-a-uuid"
        object_id = uuid.uuid4()

        with pytest.raises(ValueError, match=r"User ID must be a UUID"):
            await self.enforcer.add_casbin_user_role(user_id, object_id)

    async def test_add_user_role_invalid_object(self):
        mock_enforcer = AsyncMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = uuid.uuid4()
        object_id = 1234  # invalid type

        with pytest.raises(ValueError, match=r"Casbin object must be a string or UUID"):
            await self.enforcer.add_casbin_user_role(user_id, object_id)  # pyright: ignore[reportArgumentType]

    async def test_add_user_role_invalid_object_string(self):
        mock_enforcer = AsyncMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = uuid.uuid4()
        object_id = "Invalid-String!"  # fails regex

        with pytest.raises(ValueError, match=r"Object must be a string of lowercase letters"):
            await self.enforcer.add_casbin_user_role(user_id, object_id)

    async def test_add_user_role_no_reload(self):
        mock_enforcer = AsyncMock()
        mock_enforcer.add_role_for_user.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)
        self.enforcer.send_reload_event = AsyncMock()

        user_id = uuid.uuid4()
        object_id = "readonly"
        object_type = "role"

        result = await self.enforcer.add_casbin_user_role(user_id, object_id, object_type, send_reload_event=False)

        expected_subject = f"user:{user_id}"
        expected_object = f"{object_type}:{object_id}"

        mock_enforcer.add_role_for_user.assert_awaited_once_with(expected_subject, expected_object)
        self.enforcer.send_reload_event.assert_not_awaited()
        assert result is True


class TestEnforceCasbinUser:
    mock_adapter: MagicMock = MagicMock()
    mock_rabbitmq: MagicMock = MagicMock()
    mock_enforcer = AsyncMock()
    enforcer: CasbinEnforcer  # pyright: ignore[reportUninitializedInstanceVariable]

    def setup_method(self):
        self.mock_adapter = MagicMock()
        self.mock_rabbitmq = MagicMock()
        self.mock_rabbitmq.send_task = AsyncMock()

        CasbinEnforcer._instances.clear()
        self.enforcer = CasbinEnforcer(adapter=self.mock_adapter, rabbitmq=self.mock_rabbitmq)

    async def test_enforce_success_uuid_object(self):
        mock_enforcer = MagicMock()
        mock_enforcer.enforce.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = uuid.uuid4()
        object_id = uuid.uuid4()
        object_type = "resource"
        action = "read"

        result = await self.enforcer.enforce_casbin_user(user_id, object_id, action, object_type)

        expected_subject = f"user:{user_id}"
        expected_object = f"{object_type}:{object_id}"

        mock_enforcer.enforce.assert_called_once_with(expected_subject, expected_object, action)
        assert result is True

    async def test_enforce_success_string_object(self):
        mock_enforcer = MagicMock()
        mock_enforcer.enforce.return_value = True
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = uuid.uuid4()
        object_id = "some_dataset"
        object_type = "dataset"
        action = "write"

        result = await self.enforcer.enforce_casbin_user(user_id, object_id, action, object_type)

        expected_subject = f"user:{user_id}"
        expected_object = f"{object_type}:{object_id}"

        mock_enforcer.enforce.assert_called_once_with(expected_subject, expected_object, action)
        assert result is True

    async def test_enforce_invalid_user_id(self):
        self.enforcer.get_enforcer = AsyncMock()

        user_id = "not-a-uuid"
        object_id = uuid.uuid4()

        with pytest.raises(AssertionError, match="User ID must be a UUID"):
            await self.enforcer.enforce_casbin_user(user_id, object_id)

    async def test_enforce_invalid_object_type(self):
        mock_enforcer = MagicMock()
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = uuid.uuid4()
        object_id = 123  # Invalid type

        with pytest.raises(ValueError, match="Casbin object must be a string or UUID"):
            await self.enforcer.enforce_casbin_user(user_id, object_id)  # pyright: ignore[reportArgumentType]

    async def test_enforce_action_not_allowed(self):
        self.enforcer.get_enforcer = AsyncMock()

        user_id = uuid.uuid4()
        object_id = uuid.uuid4()
        invalid_action = "wrong_action"

        result = await self.enforcer.enforce_casbin_user(user_id, object_id, action=invalid_action)
        assert result is False

    async def test_enforce_denied(self):
        mock_enforcer = MagicMock()
        mock_enforcer.enforce.return_value = False
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        user_id = uuid.uuid4()
        object_id = "private_data"
        object_type = "dataset"
        action = "read"

        result = await self.enforcer.enforce_casbin_user(user_id, object_id, action, object_type)

        expected_subject = f"user:{user_id}"
        expected_object = f"{object_type}:{object_id}"

        mock_enforcer.enforce.assert_called_once_with(expected_subject, expected_object, action)
        assert result is False


class TestListUserPermissionsForEntity:
    mock_adapter: MagicMock = MagicMock()
    mock_rabbitmq: MagicMock = MagicMock()
    enforcer: CasbinEnforcer  # pyright: ignore[reportUninitializedInstanceVariable]

    def setup_method(self):
        self.mock_adapter = MagicMock()
        self.mock_rabbitmq = MagicMock()
        self.mock_rabbitmq.send_task = AsyncMock()

        CasbinEnforcer._instances.clear()
        self.enforcer = CasbinEnforcer(adapter=self.mock_adapter, rabbitmq=self.mock_rabbitmq)

    async def test_list_permissions_admin(self):
        self.enforcer.enforce_casbin_user = AsyncMock(side_effect=[True, False, False])

        user_id = uuid.uuid4()
        resource_id = "res_123"

        permissions = await self.enforcer.list_user_permissions_for_entity(user_id, resource_id)

        assert permissions == ["read", "write", "admin"]
        self.enforcer.enforce_casbin_user.assert_awaited_with(user_id, resource_id, "admin")

    async def test_list_permissions_write(self):
        self.enforcer.enforce_casbin_user = AsyncMock(side_effect=[False, True, False])

        user_id = uuid.uuid4()
        resource_id = "res_456"

        permissions = await self.enforcer.list_user_permissions_for_entity(user_id, resource_id)

        assert permissions == ["read", "write"]
        self.enforcer.enforce_casbin_user.assert_any_await(user_id, resource_id, "write")

    async def test_list_permissions_read(self):
        self.enforcer.enforce_casbin_user = AsyncMock(side_effect=[False, False, True])

        user_id = uuid.uuid4()
        resource_id = "res_789"

        permissions = await self.enforcer.list_user_permissions_for_entity(user_id, resource_id)

        assert permissions == ["read"]
        self.enforcer.enforce_casbin_user.assert_any_await(user_id, resource_id, "read")

    async def test_list_permissions_none(self):
        self.enforcer.enforce_casbin_user = AsyncMock(side_effect=[False, False, False])

        user_id = uuid.uuid4()
        resource_id = "res_000"

        permissions = await self.enforcer.list_user_permissions_for_entity(user_id, resource_id)

        assert permissions == []


class TestGetUserRoles:
    mock_adapter: MagicMock = MagicMock()
    mock_rabbitmq: MagicMock = MagicMock()
    enforcer: CasbinEnforcer  # pyright: ignore[reportUninitializedInstanceVariable]

    def setup_method(self):
        self.mock_adapter = MagicMock()
        self.mock_rabbitmq = MagicMock()
        self.mock_rabbitmq.send_task = AsyncMock()

        CasbinEnforcer._instances.clear()
        self.enforcer = CasbinEnforcer(adapter=self.mock_adapter, rabbitmq=self.mock_rabbitmq)

    async def test_get_user_roles_success(self):
        user_id = uuid.uuid4()
        expected_subject = f"user:{user_id}"
        mock_roles = [
            [expected_subject, "admin"],
            [expected_subject, "writer"],
            [expected_subject, "admin"],  # Duplicate to test set logic
        ]

        mock_enforcer = MagicMock()
        mock_enforcer.get_filtered_named_grouping_policy.return_value = mock_roles
        self.enforcer.get_enforcer = AsyncMock(return_value=mock_enforcer)

        roles = await self.enforcer.get_user_roles(user_id)

        assert sorted(roles) == sorted(["admin", "writer"])
        mock_enforcer.get_filtered_named_grouping_policy.assert_called_once_with("g", 0, expected_subject)

    async def test_get_user_roles_invalid_user_id(self):
        invalid_user_id = "not-a-uuid"
        with pytest.raises(AssertionError, match=r"User ID must be a UUID"):
            await self.enforcer.get_user_roles(invalid_user_id)
