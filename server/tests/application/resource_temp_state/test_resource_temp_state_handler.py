from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.resource_temp_state.handler import ResourceTempStateHandler


def make_handler(value: dict[str, Any]) -> tuple[ResourceTempStateHandler, Mock, AsyncMock]:
    session = AsyncMock()
    handler = ResourceTempStateHandler(session=session)
    row = Mock(value=value)
    handler.get_by_resource_id = AsyncMock(return_value=row)
    return handler, row, session


class TestDiscardKeys:
    @pytest.mark.asyncio
    async def test_no_temp_state(self):
        handler, _, session = make_handler({})
        handler.get_by_resource_id = AsyncMock(return_value=None)

        assert await handler.discard_keys(uuid4(), ["description"]) is False
        session.delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_no_matching_key(self):
        handler, row, session = make_handler({"labels": ["a"]})

        assert await handler.discard_keys(uuid4(), ["description"]) is False
        assert row.value == {"labels": ["a"]}
        session.delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_partial_keeps_row(self):
        handler, row, session = make_handler({"labels": ["a"], "description": "new"})

        assert await handler.discard_keys(uuid4(), ["description"]) is True
        assert row.value == {"labels": ["a"]}
        session.delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_all_keys_deletes_row(self):
        handler, row, session = make_handler({"description": "new"})

        assert await handler.discard_keys(uuid4(), ["description"]) is True
        session.delete.assert_awaited_once_with(row)
        session.flush.assert_awaited_once()
