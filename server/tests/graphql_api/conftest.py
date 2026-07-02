from unittest.mock import AsyncMock

import pytest


@pytest.fixture(autouse=True)
def allow_graphql_api_reads(monkeypatch):
    async def _mock_init_enforcer(self):
        self.enforcer = AsyncMock()

    monkeypatch.setattr("graphql_api.helpers.user_has_access_to_api", AsyncMock(return_value=True))
    monkeypatch.setattr("graphql_api.helpers.CasbinEnforcer.init_enforcer", _mock_init_enforcer)
