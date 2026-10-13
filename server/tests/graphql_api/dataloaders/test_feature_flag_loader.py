"""Tests for the feature flag entity loader (audit log resolution)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from graphql_api.dataloaders.entity_loaders import (
    _load_feature_flags,
    entity_loaders,
)


FLAG_ID = uuid4()

ROW = SimpleNamespace(id=FLAG_ID, name="mcp", enabled=True)


def _session_with_rows(rows):
    session = MagicMock()
    session.execute = AsyncMock(return_value=iter(rows))
    return session


class TestFeatureFlagLoader:
    async def test_resolves_flag_by_id(self):
        session = _session_with_rows([ROW])

        resolved = await _load_feature_flags([str(FLAG_ID), str(uuid4())], session)

        assert resolved[0] == {
            "id": str(FLAG_ID),
            "name": "mcp",
            "entityName": "feature_flag",
        }

    async def test_missing_id_resolves_to_none(self):
        session = _session_with_rows([])

        resolved = await _load_feature_flags([str(FLAG_ID)], session)

        assert resolved == [None]

    def test_loader_is_registered_under_feature_flag_key(self):
        loaders = entity_loaders(MagicMock())

        assert "feature_flag" in loaders
