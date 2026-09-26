from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from apscheduler.triggers.cron import CronTrigger


def build_cron_trigger(cron: str, timezone: str | None = None) -> CronTrigger:
    return CronTrigger.from_crontab(cron, timezone=ZoneInfo(timezone or "UTC"))


def next_cron_run(cron: str, timezone: str | None = None, after: datetime | None = None) -> datetime | None:
    """Return the next fire time of a cron expression evaluated in the given IANA time zone."""
    trigger = build_cron_trigger(cron, timezone)
    now = after or datetime.now(UTC)
    next_run = trigger.get_next_fire_time(None, now.astimezone(trigger.timezone))
    return next_run.astimezone(UTC) if next_run else None
