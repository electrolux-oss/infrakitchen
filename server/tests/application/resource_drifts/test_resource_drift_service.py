from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import uuid4

from application.resource_drifts.service import MAX_ERROR_LENGTH, ResourceDriftService
from core.constants.model import DriftStatus, EventType

BUCKET_KEY = "aws_s3_bucket.this|tags.Owner"
DRIFTED_SUMMARY = {"drifted": True, "total": 1, "source": "json", "changes": []}
IN_SYNC_SUMMARY = {"drifted": False, "total": 0, "source": "json", "changes": []}


def sent_events(service: ResourceDriftService) -> list[Any]:
    send_event = cast(AsyncMock, service.event_sender.send_event)
    return [call.args for call in send_event.call_args_list]


async def test_a_result_is_saved_and_sent_as_a_drift_update(resource_drift_service):
    resource_id = uuid4()

    drift = (await resource_drift_service.record_result(resource_id, DriftStatus.IN_SYNC, IN_SYNC_SUMMARY, [])).drift

    assert (drift.status, drift.summary, drift.known_drift) == (DriftStatus.IN_SYNC, IN_SYNC_SUMMARY, [])
    assert drift.checked_at is not None
    [(update, event_type)] = sent_events(resource_drift_service)
    assert event_type == EventType.DRIFT_UPDATED
    # only the drift is sent, never a copy of the resource that could overwrite its newer status
    assert update.id == resource_id
    assert update.drift.status == DriftStatus.IN_SYNC
    assert update.model_dump()["_entity_name"] == "resource"


async def test_first_detected_at_is_kept_while_drifted_and_cleared_when_in_sync(resource_drift_service):
    resource_id = uuid4()
    drift = (await resource_drift_service.record_result(resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [])).drift
    first = drift.first_detected_at
    assert first is not None

    # a failed check or a failed apply in between doesn't reset it
    await resource_drift_service.record_failure(resource_id, "boom")
    await resource_drift_service.mark_outdated(resource_id)
    drift = (await resource_drift_service.record_result(resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [])).drift
    assert drift.first_detected_at == first

    drift = (await resource_drift_service.record_result(resource_id, DriftStatus.IN_SYNC, IN_SYNC_SUMMARY, [])).drift
    assert drift.first_detected_at is None


async def test_a_failed_check_keeps_the_last_result_and_counts_the_failures(resource_drift_service):
    resource_id = uuid4()
    await resource_drift_service.record_result(resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [BUCKET_KEY])

    await resource_drift_service.record_failure(resource_id, "credentials expired")
    drift = await resource_drift_service.record_failure(resource_id, "x" * (MAX_ERROR_LENGTH + 10))

    # it can't tell whether the resource drifted: the drift found before stays visible
    assert (drift.status, drift.summary, drift.known_drift) == (DriftStatus.DRIFTED, DRIFTED_SUMMARY, [BUCKET_KEY])
    assert drift.consecutive_failures == 2
    assert drift.last_error is not None and len(drift.last_error) == MAX_ERROR_LENGTH
    assert drift.last_error_at is not None


async def test_the_first_failed_check_of_a_resource_is_saved_as_error(resource_drift_service):
    resource_id = uuid4()

    drift = await resource_drift_service.record_failure(resource_id, "boom")

    assert (drift.status, drift.consecutive_failures, drift.last_error) == (DriftStatus.ERROR, 1, "boom")
    assert drift.checked_at is not None and drift.summary is None


async def test_a_successful_check_ends_the_failures(resource_drift_service):
    resource_id = uuid4()
    await resource_drift_service.record_failure(resource_id, "boom")

    drift = (await resource_drift_service.record_result(resource_id, DriftStatus.IN_SYNC, IN_SYNC_SUMMARY, [])).drift

    assert (drift.status, drift.consecutive_failures, drift.last_error, drift.last_error_at) == (
        DriftStatus.IN_SYNC,
        0,
        None,
        None,
    )


async def test_new_drift_is_what_was_not_known_before(resource_drift_service):
    resource_id = uuid4()
    other_key = "aws_iam_role.app|create"

    recorded = await resource_drift_service.record_result(
        resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [BUCKET_KEY]
    )
    assert (recorded.new_keys, recorded.first) == ({BUCKET_KEY}, True)

    # the same drift again: nothing new
    recorded = await resource_drift_service.record_result(
        resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [BUCKET_KEY]
    )
    assert (recorded.new_keys, recorded.first) == (set(), False)

    keys = [BUCKET_KEY, other_key]
    recorded = await resource_drift_service.record_result(resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, keys)
    assert (recorded.new_keys, recorded.first) == ({other_key}, False)

    # back in sync forgets it: the same drift found later happened again
    recorded = await resource_drift_service.record_result(resource_id, DriftStatus.IN_SYNC, IN_SYNC_SUMMARY, [])
    assert recorded.new_keys == set()
    recorded = await resource_drift_service.record_result(
        resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [BUCKET_KEY]
    )
    assert (recorded.new_keys, recorded.first) == ({BUCKET_KEY}, True)


async def test_a_failed_apply_outdates_the_result_and_keeps_the_known_drift(resource_drift_service):
    resource_id = uuid4()
    await resource_drift_service.record_result(resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [BUCKET_KEY])
    first_detected_at = (await resource_drift_service.get_by_resource_id(resource_id)).first_detected_at
    await resource_drift_service.record_failure(resource_id, "boom")

    drift = await resource_drift_service.mark_outdated(resource_id)

    assert drift is not None
    assert drift.status == DriftStatus.UNKNOWN
    # the result stays visible as it was, the status tells it is outdated
    assert drift.summary == DRIFTED_SUMMARY
    # the drift may still be there, so it isn't notified again
    assert (drift.known_drift, drift.first_detected_at) == ([BUCKET_KEY], first_detected_at)
    assert (drift.consecutive_failures, drift.last_error) == (0, None)
    update, _ = sent_events(resource_drift_service)[-1]
    assert update.drift.status == DriftStatus.UNKNOWN


async def test_a_successful_apply_sets_the_resource_in_sync_and_forgets_the_notified_drift(resource_drift_service):
    resource_id = uuid4()
    drift = (
        await resource_drift_service.record_result(resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [BUCKET_KEY])
    ).drift
    checked_at = drift.checked_at
    await resource_drift_service.record_failure(resource_id, "boom")

    drift = await resource_drift_service.mark_applied(resource_id)

    # the apply set the infrastructure to the configuration: no check is needed to know it is in sync
    assert drift is not None
    assert (drift.status, drift.known_drift, drift.first_detected_at) == (DriftStatus.IN_SYNC, [], None)
    assert drift.summary == {"drifted": False, "total": 0, "changes": [], "source": "apply"}
    # the next scheduled check is due an interval after the apply
    assert drift.checked_at >= checked_at
    assert (drift.consecutive_failures, drift.last_error) == (0, None)
    update, _ = sent_events(resource_drift_service)[-1]
    assert update.drift.status == DriftStatus.IN_SYNC

    # the same drift found later happened again
    recorded = await resource_drift_service.record_result(
        resource_id, DriftStatus.DRIFTED, DRIFTED_SUMMARY, [BUCKET_KEY]
    )
    assert (recorded.new_keys, recorded.first) == ({BUCKET_KEY}, True)
    assert recorded.drift.first_detected_at is not None


async def test_an_apply_of_a_resource_without_a_result_changes_nothing(resource_drift_service):
    # drift detection stays out of resources it never checked
    assert await resource_drift_service.mark_applied(uuid4()) is None
    assert await resource_drift_service.mark_outdated(uuid4()) is None
    assert sent_events(resource_drift_service) == []


async def test_clear_removes_the_result_and_sends_an_empty_drift(resource_drift_service, fake_resource_drift_crud):
    resource_id = uuid4()
    await resource_drift_service.record_result(resource_id, DriftStatus.IN_SYNC, IN_SYNC_SUMMARY, [])

    await resource_drift_service.clear(resource_id)

    assert resource_id not in fake_resource_drift_crud.rows
    update, event_type = sent_events(resource_drift_service)[-1]
    assert event_type == EventType.DRIFT_UPDATED
    assert update.id == resource_id and update.drift is None
