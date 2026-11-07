from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from application.resource_drifts.crud import DriftSettingsCRUD
from application.resource_drifts.model import (
    DEFAULT_DRIFT_INTERVAL_HOURS,
    DRIFT_SETTINGS_ID,
    DriftSettings,
    DriftSettingsDTO,
)
from application.resource_drifts.service import DriftSettingsService


def make_service(row: DriftSettings | None) -> tuple[DriftSettingsService, Mock, Mock]:
    crud = Mock(spec=DriftSettingsCRUD)
    crud.get = AsyncMock(return_value=row)
    crud.get_or_create = AsyncMock(return_value=row)

    async def update(existing: DriftSettings, body: dict[str, Any]) -> DriftSettings:
        for key, value in body.items():
            setattr(existing, key, value)
        return existing

    crud.update = AsyncMock(side_effect=update)
    audit_log_handler = Mock(create_log=AsyncMock())
    return DriftSettingsService(crud=crud, audit_log_handler=audit_log_handler), crud, audit_log_handler


async def test_drift_detection_is_off_by_default():
    service, _, _ = make_service(None)

    settings = await service.get()

    assert settings.enabled is False
    assert settings.interval_hours == DEFAULT_DRIFT_INTERVAL_HOURS


async def test_settings_are_read_from_the_row():
    service, _, _ = make_service(DriftSettings(enabled=True, interval_hours=6))

    assert await service.get() == DriftSettingsDTO(enabled=True, interval_hours=6)


async def test_save_updates_the_row_records_the_user_and_writes_an_audit_log():
    row = DriftSettings(id=DRIFT_SETTINGS_ID, enabled=False, interval_hours=24)
    service, crud, audit_log_handler = make_service(row)
    requester = SimpleNamespace(id=uuid4())

    saved = await service.update(DriftSettingsDTO(enabled=True, interval_hours=12), requester)  # pyright: ignore[reportArgumentType]

    crud.get_or_create.assert_awaited_once()
    assert (row.enabled, row.interval_hours, row.updated_by) == (True, 12, requester.id)
    assert saved == DriftSettingsDTO(enabled=True, interval_hours=12)
    log = audit_log_handler.create_log.call_args
    assert log.args[:3] == (DRIFT_SETTINGS_ID, requester.id, "update")
    assert log.kwargs["action_metadata"] == {"enabled": True, "interval_hours": 12}


async def test_the_row_is_created_once_with_a_fixed_id():
    # two first saves at the same time must not create two rows
    row = DriftSettings(id=DRIFT_SETTINGS_ID)
    session = Mock(execute=AsyncMock(), get=AsyncMock(return_value=row))

    assert await DriftSettingsCRUD(session).get_or_create() is row

    insert = str(session.execute.call_args.args[0].compile(dialect=postgresql.dialect()))
    assert "INSERT INTO drift_settings" in insert
    assert "ON CONFLICT (id) DO NOTHING" in insert
    session.get.assert_awaited_once_with(DriftSettings, DRIFT_SETTINGS_ID)


@pytest.mark.parametrize("hours", [0, -1, 24 * 365 + 1])
def test_interval_must_be_between_an_hour_and_a_year(hours):
    with pytest.raises(ValidationError):
        DriftSettingsDTO(enabled=True, interval_hours=hours)
