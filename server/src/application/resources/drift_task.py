import asyncio
import logging
from typing import Any

from core.config import Settings
from core.constants.model import DriftStatus, EventType, ModelActions
from core.errors import CannotProceed, CloudExecutionError, CloudWrongCredentials, ExitWithoutSave
from core.notifications.controller import NotificationEvent, publish_notification_event
from core.notifications.text import entity_reference, notification_message, notification_title

from ..tools import OtfClient
from ..tools.tf_drift import DriftResult
from .functions import drift_check_blocker
from .task import ResourceTask

logger = logging.getLogger(__name__)


class ResourceDriftTask(ResourceTask):
    """
    `check_drift` plans the configuration against the real infrastructure: the drift is what the next
    apply would change. It never changes the resource or its status; the result is saved with `self.drift_service`.
    """

    EXPIRING_ACTIONS: tuple[ModelActions, ...] = (ModelActions.DRYRUN, ModelActions.CHECK_DRIFT)

    async def run_other_action(self) -> None:
        if self.action == ModelActions.CHECK_DRIFT:
            await self.check_drift()
        else:
            await super().run_other_action()

    async def make_failed(self) -> None:
        """Called by the worker when a task fails unexpectedly or its worker is lost (reaped)."""
        if self.action != ModelActions.CHECK_DRIFT:
            await super().make_failed()
            return
        if drift_check_blocker(self.resource_instance):
            # e.g. destroyed meanwhile: there is no drift to record
            return
        # the resource is fine, only the check failed; recording it also moves the scheduler on
        try:
            await self.save_failure("The drift check did not finish, see the logs for details")
        except Exception:
            logger.exception(f"Failed to save the failed drift check of resource {self.resource_instance.id}")

    async def check_drift(self) -> None:
        self.logger.add_result(operation="drift_check")
        # checked when queued, but the resource may have changed since, e.g. a destroy ran first
        if blocker := drift_check_blocker(self.resource_instance):
            self.logger.info(f"Drift check skipped: {blocker}")
            self.logger.add_result(drift_skipped=blocker)
            return
        self.logger.info("Run drift check")

        result: DriftResult | None = None
        # user actions on the resource wait for the check, so a hung plan must not hold it forever
        timeout_seconds = Settings().DRIFT_CHECK_TIMEOUT_SECONDS
        deadline = asyncio.timeout(timeout_seconds)
        try:
            async with deadline:
                tf_client = await self._init_drift_workspace()
                result = await tf_client.drift_check()
        except Exception as e:
            timed_out = deadline.expired()
            error = f"Drift check timed out after {timeout_seconds // 60} minutes" if timed_out else str(e)
            # keep tracebacks out of the user-facing entity log; the worker logs the message
            if not timed_out and not isinstance(e, (CloudWrongCredentials, CloudExecutionError)):
                logger.exception(f"Drift check failed for resource {self.resource_instance.id}")
            await self.clean_workspace()
            await self.save_failure(error)
            raise ExitWithoutSave(error) from e

        await self.clean_workspace()
        resource_id = self.resource_instance.id
        status = DriftStatus.DRIFTED if result.summary["drifted"] else DriftStatus.IN_SYNC
        recorded = await self.drift_service.record_result(resource_id, status, result.summary, result.keys)
        await self.commit_drift()

        # notify only about drift that wasn't reported before, not on every scheduled check;
        # a successful apply forgets the reported drift, so drift that comes back after it is notified again
        if recorded.new_keys:
            # the result is saved: a failed notification must not turn the check into a failed one
            try:
                await self.notify_detected(result.summary, recorded.new_keys, first=recorded.first)
            except Exception:
                logger.exception(f"Failed to notify about the drift of resource {resource_id}")

    async def save_failure(self, error: str) -> None:
        _ = await self.drift_service.record_failure(self.resource_instance.id, error)
        await self.commit_drift()

    async def commit_drift(self) -> None:
        """Commit the drift result and send its event, as `change_entity_status` does for the resource."""
        if hasattr(self.logger, "save_log"):
            await self.logger.save_log()
        await self.session.commit()
        await self.event_sender.flush()

    async def notify_detected(self, summary: dict[str, Any], new_keys: set[str], first: bool) -> None:
        resource = self.resource_instance
        reference = entity_reference("resource", resource.name)
        if first:
            # the change list is truncated for huge plans, the total is not
            count = summary.get("total", len(summary.get("changes", [])))
            message = f"{reference} no longer matches its configuration: {count} object(s) would be changed by an apply"
        else:
            addresses = {key.split("|", 1)[0] for key in new_keys}
            message = f"{reference} has new drift: {len(addresses)} object(s) would be changed by an apply"
        await publish_notification_event(
            NotificationEvent(
                event_type=EventType.DRIFT_DETECTED,
                entity_type="resource",
                entity_id=str(resource.id),
                entity_name=resource.name,
                title=notification_title("resource", "drift detected"),
                status="warning",
                message=notification_message(message),
            )
        )

    async def _init_drift_workspace(self) -> OtfClient:
        await self.init_workspace()
        await self.init_provision_tool()

        assert self.workspace_path is not None, "Workspace path is not defined"
        assert self.source_code_instance is not None, "Source Code instance is not defined"

        if self.source_code_instance.source_code_language != "opentofu":
            raise CannotProceed("Drift check is supported only for OpenTofu source code")
        if self.tf_client is None:
            raise ExitWithoutSave("Tofu client is not defined")

        await self.tf_client.init()
        return self.tf_client
