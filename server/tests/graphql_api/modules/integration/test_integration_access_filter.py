from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from graphql_api.schema import schema

INTEGRATIONS_QUERY = """
    query Integrations($access: String, $includeIds: [UUID!]) {
        integrations(access: $access, includeIds: $includeIds) { id }
        integrationsCount(access: $access, includeIds: $includeIds)
    }
"""

CLOUD_1 = str(uuid4())
INHERITED = str(uuid4())


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


def make_service():
    service = Mock()
    service.query_all = AsyncMock(return_value=[])
    service.count = AsyncMock(return_value=0)
    return service


@pytest.mark.asyncio
@patch("graphql_api.helpers.user_entity_ids", new_callable=AsyncMock)
@patch("graphql_api.modules.integration.queries.get_integration_service")
async def test_write_access_restricts_list_and_count(get_service, user_entity_ids):
    service = make_service()
    get_service.return_value = service
    user_entity_ids.return_value = {CLOUD_1}

    result = await schema.execute(
        INTEGRATIONS_QUERY,
        variable_values={"access": "write", "includeIds": [INHERITED]},
        context_value=make_context(SimpleNamespace(id=uuid4(), deactivated=False)),
    )

    assert result.errors is None
    assert user_entity_ids.await_args.args[1:] == ("integration", "write")
    assert service.query_all.await_args.kwargs["restrict_ids"] == {CLOUD_1, INHERITED}
    assert service.count.await_args.kwargs["restrict_ids"] == {CLOUD_1, INHERITED}


@pytest.mark.asyncio
@patch("graphql_api.helpers.user_entity_ids", new_callable=AsyncMock)
@patch("graphql_api.modules.integration.queries.get_integration_service")
async def test_wildcard_access_is_unrestricted(get_service, user_entity_ids):
    service = make_service()
    get_service.return_value = service
    user_entity_ids.return_value = None

    result = await schema.execute(
        INTEGRATIONS_QUERY,
        variable_values={"access": "write"},
        context_value=make_context(SimpleNamespace(id=uuid4(), deactivated=False)),
    )

    assert result.errors is None
    assert service.query_all.await_args.kwargs["restrict_ids"] is None


@pytest.mark.asyncio
@patch("graphql_api.helpers.user_entity_ids", new_callable=AsyncMock)
@patch("graphql_api.modules.integration.queries.get_integration_service")
async def test_no_access_argument_keeps_previous_behaviour(get_service, user_entity_ids):
    service = make_service()
    get_service.return_value = service

    result = await schema.execute(
        INTEGRATIONS_QUERY,
        context_value=make_context(SimpleNamespace(id=uuid4(), deactivated=False)),
    )

    assert result.errors is None
    user_entity_ids.assert_not_awaited()
    assert service.query_all.await_args.kwargs["restrict_ids"] is None


@pytest.mark.asyncio
@patch("graphql_api.modules.integration.queries.get_integration_service")
async def test_invalid_access_level_is_rejected(get_service):
    get_service.return_value = make_service()

    result = await schema.execute(
        INTEGRATIONS_QUERY,
        variable_values={"access": "delete"},
        context_value=make_context(SimpleNamespace(id=uuid4(), deactivated=False)),
    )

    assert result.errors is not None
    assert "Invalid access level" in result.errors[0].message
