from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from core.constants.model import ModelActions
from core.tasks.functions import next_cron_run
from core.tasks.schema import TaskScheduleCreate


def build(**kwargs):
    return TaskScheduleCreate.model_validate(
        {"entity_id": uuid4(), "entity": "resource", "action": ModelActions.EXECUTE, **kwargs}
    )


class TestTaskScheduleCreate:
    def test_one_time_schedule(self):
        run_at = datetime.now(UTC) + timedelta(hours=1)
        schedule = build(run_at=run_at)
        assert schedule.run_at == run_at
        assert schedule.cron is None

    def test_recurring_schedule(self):
        schedule = build(cron=" 0 2 * * * ", timezone="Europe/Stockholm")
        assert schedule.cron == "0 2 * * *"
        assert schedule.timezone == "Europe/Stockholm"
        assert schedule.run_at is None

    def test_recurring_schedule_defaults_to_utc(self):
        assert build(cron="0 * * * *").timezone == "UTC"

    def test_both_run_at_and_cron_rejected(self):
        with pytest.raises(ValidationError, match="Exactly one of run_at or cron"):
            build(run_at=datetime.now(UTC) + timedelta(hours=1), cron="0 * * * *")

    def test_neither_run_at_nor_cron_rejected(self):
        with pytest.raises(ValidationError, match="Exactly one of run_at or cron"):
            build()

    def test_invalid_cron_rejected(self):
        with pytest.raises(ValidationError, match="Invalid cron expression"):
            build(cron="every day")

    def test_invalid_timezone_rejected(self):
        with pytest.raises(ValidationError, match="Invalid time zone"):
            build(cron="0 * * * *", timezone="Mars/Olympus")

    def test_past_run_at_rejected(self):
        with pytest.raises(ValidationError, match="must be in the future"):
            build(run_at=datetime.now(UTC) - timedelta(minutes=1))


class TestNextCronRun:
    def test_respects_timezone(self):
        after = datetime(2026, 1, 15, 12, 0, tzinfo=UTC)
        # 02:00 in Stockholm (UTC+1 in winter) is 01:00 UTC
        assert next_cron_run("0 2 * * *", "Europe/Stockholm", after=after) == datetime(2026, 1, 16, 1, 0, tzinfo=UTC)

    def test_defaults_to_utc(self):
        after = datetime(2026, 1, 15, 12, 0, tzinfo=UTC)
        assert next_cron_run("0 2 * * *", None, after=after) == datetime(2026, 1, 16, 2, 0, tzinfo=UTC)
