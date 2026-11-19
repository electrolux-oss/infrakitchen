from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from core.audit_logs.handler import AuditLogHandler
from core.constants.model import DriftStatus, EventType
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import DriftSettingsCRUD, ResourceDriftCRUD
from .model import DRIFT_SETTINGS_ID, DriftSettingsDTO, ResourceDrift
from .schema import ResourceDriftResponse, ResourceDriftUpdate

# a failed check keeps its error message for the UI, which only needs the start of a long one
MAX_ERROR_LENGTH = 2000
# a successful check or apply ends a series of failed checks
NO_FAILURES: dict[str, Any] = {"consecutive_failures": 0, "last_error": None, "last_error_at": None}


@dataclass
class RecordedDrift:
    """A saved check result, with the drift in it that wasn't notified before."""

    drift: ResourceDrift
    # drift keys the resource didn't have before the check; empty unless it drifted
    new_keys: set[str]
    # no drift was known before the check: the resource started drifting
    first: bool


class ResourceDriftService:
    """
    The drift result of a resource: what a check, a failed check, an apply and a destroy change.
    Changes are flushed and the UI events buffered; the task commits and flushes them.
    """

    def __init__(self, crud: ResourceDriftCRUD, event_sender: EventSender):
        self.crud: ResourceDriftCRUD = crud
        self.event_sender: EventSender = event_sender

    async def get_by_resource_id(self, resource_id: UUID) -> ResourceDrift | None:
        return await self.crud.get_by_resource_id(resource_id)

    async def record_result(
        self, resource_id: UUID, status: DriftStatus, summary: dict[str, Any], keys: list[str]
    ) -> RecordedDrift:
        """Save a successful check; it ends a series of failed checks."""
        drift = await self.crud.get_by_resource_id(resource_id)
        known = set((drift.known_drift if drift else None) or [])
        now = datetime.now(UTC)
        first_detected_at = None
        if status == DriftStatus.DRIFTED:
            # a failed check or a failed apply in between doesn't reset when the drift was found
            first_detected_at = (drift.first_detected_at if drift else None) or now
        body: dict[str, Any] = {
            "status": status,
            "checked_at": now,
            "first_detected_at": first_detected_at,
            "summary": summary,
            "known_drift": keys,
            **NO_FAILURES,
        }
        saved = await self._save(resource_id, drift, body)
        new_keys: set[str] = set(keys) - known if status == DriftStatus.DRIFTED else set()
        return RecordedDrift(drift=saved, new_keys=new_keys, first=not known)

    async def record_failure(self, resource_id: UUID, error: str) -> ResourceDrift:
        """
        Save a failed check. The last result and its known drift stay: the check can't tell whether the
        resource drifted, and the same drift must not be notified again once a check succeeds.
        """
        drift = await self.crud.get_by_resource_id(resource_id)
        now = datetime.now(UTC)
        body: dict[str, Any] = {
            "consecutive_failures": (drift.consecutive_failures if drift else 0) + 1,
            "last_error": error[:MAX_ERROR_LENGTH],
            "last_error_at": now,
        }
        if drift is None:
            body.update(status=DriftStatus.ERROR, checked_at=now)
        return await self._save(resource_id, drift, body)

    async def mark_applied(self, resource_id: UUID) -> ResourceDrift | None:
        """
        A successful apply sets the infrastructure to the configuration, so the resource is in sync without
        a check. Drift found after it happened again and is notified again, even when it is the same as
        before. A resource that was never checked keeps having no result.
        """
        drift = await self.crud.get_by_resource_id(resource_id)
        if drift is None:
            return None
        body: dict[str, Any] = {
            "status": DriftStatus.IN_SYNC,
            "checked_at": datetime.now(UTC),
            "first_detected_at": None,
            # no check ran: `source` tells the UI the result comes from the apply
            "summary": {"drifted": False, "total": 0, "changes": [], "source": "apply"},
            "known_drift": [],
            **NO_FAILURES,
        }
        return await self._save(resource_id, drift, body)

    async def mark_outdated(self, resource_id: UUID) -> ResourceDrift | None:
        """
        A failed apply may have changed part of the infrastructure, so the last result is outdated. Its known
        drift stays: the apply may not have fixed it, and the same drift must not be notified twice.
        """
        drift = await self.crud.get_by_resource_id(resource_id)
        if drift is None:
            return None
        return await self._save(resource_id, drift, {"status": DriftStatus.UNKNOWN, **NO_FAILURES})

    async def clear(self, resource_id: UUID) -> None:
        """A destroyed resource has nothing to compare."""
        await self.crud.delete_by_resource_id(resource_id)
        await self._send_update(resource_id, None)

    async def _save(self, resource_id: UUID, drift: ResourceDrift | None, body: dict[str, Any]) -> ResourceDrift:
        if drift is None:
            drift = await self.crud.create({"resource_id": resource_id, **body})
        else:
            drift = await self.crud.update(drift, body)
        await self._send_update(resource_id, drift)
        return drift

    async def _send_update(self, resource_id: UUID, drift: ResourceDrift | None) -> None:
        # a body of its own, so a stale copy of the resource can't overwrite its newer status in the UI
        update = ResourceDriftUpdate(
            id=resource_id,
            drift=ResourceDriftResponse.model_validate(drift) if drift else None,
        )
        await self.event_sender.send_event(update, EventType.DRIFT_UPDATED)


class DriftSettingsService:
    """Global drift settings; drift detection is off until an admin enables it."""

    def __init__(self, crud: DriftSettingsCRUD, audit_log_handler: AuditLogHandler):
        self.crud: DriftSettingsCRUD = crud
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get(self) -> DriftSettingsDTO:
        row = await self.crud.get()
        return DriftSettingsDTO.model_validate(row) if row else DriftSettingsDTO()

    async def update(self, settings: DriftSettingsDTO, requester: UserDTO) -> DriftSettingsDTO:
        row = await self.crud.get_or_create()
        row = await self.crud.update(
            row,
            {"enabled": settings.enabled, "interval_hours": settings.interval_hours, "updated_by": requester.id},
        )
        await self.audit_log_handler.create_log(
            DRIFT_SETTINGS_ID,
            requester.id,
            "update",
            action_metadata={"enabled": settings.enabled, "interval_hours": settings.interval_hours},
        )
        return DriftSettingsDTO.model_validate(row)
