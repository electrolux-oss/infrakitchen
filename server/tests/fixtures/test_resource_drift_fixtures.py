from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import UUID

import pytest

from application.resource_drifts.model import ResourceDrift
from application.resource_drifts.service import ResourceDriftService


class FakeResourceDriftCRUD:
    """ResourceDriftCRUD keeping the drift rows in memory, so the service rules run as they do on a database."""

    def __init__(self, *rows: ResourceDrift):
        self.rows: dict[UUID, ResourceDrift] = {row.resource_id: row for row in rows}

    async def get_by_resource_id(self, resource_id: UUID) -> ResourceDrift | None:
        return self.rows.get(resource_id)

    async def create(self, body: dict[str, Any]) -> ResourceDrift:
        drift = ResourceDrift(**body)
        self.rows[drift.resource_id] = drift
        return drift

    async def update(self, drift: ResourceDrift, body: dict[str, Any]) -> ResourceDrift:
        for key, value in body.items():
            setattr(drift, key, value)
        return drift

    async def delete_by_resource_id(self, resource_id: UUID) -> None:
        _ = self.rows.pop(resource_id, None)


@pytest.fixture
def fake_resource_drift_crud() -> FakeResourceDriftCRUD:
    return FakeResourceDriftCRUD()


@pytest.fixture
def resource_drift_service(fake_resource_drift_crud: FakeResourceDriftCRUD) -> ResourceDriftService:
    event_sender = Mock(send_event=AsyncMock(), flush=AsyncMock())
    return ResourceDriftService(crud=fake_resource_drift_crud, event_sender=event_sender)  # pyright: ignore[reportArgumentType]
