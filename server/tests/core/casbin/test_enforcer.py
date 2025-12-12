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
        with pytest.raises(ValueError, match=r"User ID must be a valid UUID"):
            await self.enforcer.get_user_roles(invalid_user_id)
