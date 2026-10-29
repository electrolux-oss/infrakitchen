from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from application.resource_drifts.model import (
    DEFAULT_DRIFT_BATCH_SIZE,
    DEFAULT_DRIFT_INTERVAL_HOURS,
    DriftSettings,
    DriftSettingsDTO,
)
from application.resource_drifts.service import get_drift_settings, update_drift_settings


def make_session(row: DriftSettings | None) -> Mock:
    return Mock(scalar=AsyncMock(return_value=row), add=Mock(), flush=AsyncMock(), refresh=AsyncMock())


async def test_drift_detection_is_off_by_default():
    settings = await get_drift_settings(make_session(None))

    assert settings.enabled is False
    assert settings.interval_hours == DEFAULT_DRIFT_INTERVAL_HOURS
    assert settings.batch_size == DEFAULT_DRIFT_BATCH_SIZE


async def test_settings_are_read_from_the_stored_row():
    row = DriftSettings(enabled=True, interval_hours=6, batch_size=50)

    settings = await get_drift_settings(make_session(row))

    assert settings == DriftSettingsDTO(enabled=True, interval_hours=6, batch_size=50)


async def test_first_save_creates_the_row():
    session = make_session(None)

    saved = await update_drift_settings(
        session, DriftSettingsDTO(enabled=True, interval_hours=12, batch_size=5), uuid4()
    )

    session.add.assert_called_once()
    row = session.add.call_args.args[0]
    assert (row.enabled, row.interval_hours, row.batch_size) == (True, 12, 5)
    assert saved == DriftSettingsDTO(enabled=True, interval_hours=12, batch_size=5)


async def test_save_updates_the_existing_row():
    row = DriftSettings(enabled=False, interval_hours=24)
    session = make_session(row)
    requester = uuid4()

    await update_drift_settings(session, DriftSettingsDTO(enabled=True, interval_hours=3, batch_size=7), requester)

    session.add.assert_not_called()
    assert (row.enabled, row.interval_hours, row.batch_size, row.updated_by) == (True, 3, 7, requester)


@pytest.mark.parametrize("hours", [0, -1])
def test_interval_must_be_positive(hours):
    with pytest.raises(ValidationError):
        DriftSettingsDTO(enabled=True, interval_hours=hours)


@pytest.mark.parametrize("batch_size", [0, 1001])
def test_batch_size_must_be_in_range(batch_size):
    with pytest.raises(ValidationError):
        DriftSettingsDTO(batch_size=batch_size)
