from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from graphql_api.modules.audit_log.types import AuditLogType


ENTITY_ID = uuid4()

resolve_entity_data = AuditLogType.entity_data
resolve_metadata = AuditLogType.resolve_metadata


class _Loader:
    def __init__(self, value):
        self.value = value
        self.requested_keys: list[str] = []

    async def load(self, key: str):
        self.requested_keys.append(key)
        return self.value


def _info(loaders: dict[str, Any]):
    return SimpleNamespace(context={"loaders": loaders})


def _audit_log(action_metadata=None):
    return SimpleNamespace(model="resource", entity_id=ENTITY_ID, action_metadata=action_metadata)


class TestEntityData:
    @pytest.mark.asyncio
    async def test_returns_live_entity(self):
        live_entity = {"id": str(ENTITY_ID), "name": "live-resource"}
        loader = _Loader(live_entity)

        result = await resolve_entity_data(_audit_log(), _info({"resource": loader}))

        assert result == live_entity
        assert loader.requested_keys == [str(ENTITY_ID)]

    @pytest.mark.asyncio
    async def test_does_not_fall_back_to_metadata_when_entity_was_deleted(self):
        result = await resolve_entity_data(
            _audit_log(action_metadata={"id": str(ENTITY_ID), "name": "deleted-resource"}),
            _info({"resource": _Loader(None)}),
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_no_loader_is_registered(self):
        result = await resolve_entity_data(_audit_log(), _info({}))

        assert result is None


class TestMetadata:
    def test_returns_stored_metadata_as_is(self):
        metadata = {"id": str(ENTITY_ID), "name": "deleted-resource", "entityName": "resource"}

        assert resolve_metadata(_audit_log(action_metadata=metadata)) == metadata

    def test_returns_none_when_no_metadata_was_stored(self):
        assert resolve_metadata(_audit_log()) is None
