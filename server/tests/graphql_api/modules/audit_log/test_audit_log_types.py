from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from graphql_api.modules.audit_log.types import AuditLogType


ENTITY_ID = uuid4()

resolve_entity_data = AuditLogType.entity_data


class _Loader:
    def __init__(self, value):
        self.value = value
        self.requested_keys: list[str] = []

    async def load(self, key: str):
        self.requested_keys.append(key)
        return self.value


def _info(loaders: dict[str, Any]):
    return SimpleNamespace(context={"loaders": loaders})


def _audit_log(entity_snapshot=None):
    action_metadata = {"entity_snapshot": entity_snapshot} if entity_snapshot is not None else None
    return SimpleNamespace(model="resource", entity_id=ENTITY_ID, action_metadata=action_metadata)


class TestEntityData:
    @pytest.mark.asyncio
    async def test_returns_live_entity_when_it_still_exists(self):
        live_entity = {"id": str(ENTITY_ID), "name": "live-resource"}
        loader = _Loader(live_entity)

        result = await resolve_entity_data(
            _audit_log(entity_snapshot={"id": str(ENTITY_ID), "name": "stale-snapshot"}),
            _info({"resource": loader}),
        )

        assert result == live_entity
        assert loader.requested_keys == [str(ENTITY_ID)]

    @pytest.mark.asyncio
    async def test_falls_back_to_snapshot_when_entity_was_deleted(self):
        snapshot = {"id": str(ENTITY_ID), "name": "deleted-resource", "entityName": "resource"}

        result = await resolve_entity_data(
            _audit_log(entity_snapshot=snapshot),
            _info({"resource": _Loader(None)}),
        )

        assert result == {**snapshot, "deleted": True}

    @pytest.mark.asyncio
    async def test_falls_back_to_snapshot_when_no_loader_is_registered(self):
        snapshot = {"id": str(ENTITY_ID), "name": "deleted-resource"}

        result = await resolve_entity_data(_audit_log(entity_snapshot=snapshot), _info({}))

        assert result == {**snapshot, "deleted": True}

    @pytest.mark.asyncio
    async def test_returns_none_when_entity_is_gone_and_no_snapshot_was_stored(self):
        result = await resolve_entity_data(_audit_log(), _info({"resource": _Loader(None)}))

        assert result is None
