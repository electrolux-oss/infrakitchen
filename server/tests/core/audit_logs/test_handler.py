"""Tests for AuditLogHandler.create_log."""

from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from core.audit_logs.handler import AuditLogHandler
from core.audit_logs.model import AuditLog


def make_handler() -> tuple[AuditLogHandler, Mock]:
    session = Mock()
    session.flush = AsyncMock()
    def add(row: AuditLog) -> None:
        # the database assigns the id on flush
        row.id = uuid4()

    session.add = Mock(side_effect=add)
    return AuditLogHandler(session=session, entity_name="resource"), session


async def test_create_log_returns_id_and_becomes_current():
    handler, _ = make_handler()

    log_id = await handler.create_log(uuid4(), uuid4(), "approve", revision_number=1)

    assert handler.audit_log_id == log_id


async def test_secondary_row_keeps_main_row_current():
    handler, _ = make_handler()
    approve_id = await handler.create_log(uuid4(), uuid4(), "approve", revision_number=1)

    # the update row written while approving must not take over: tasks started by the
    # approve request report their result on the approve row
    update_id = await handler.create_log(uuid4(), uuid4(), "update", revision_number=2, set_current=False)

    assert update_id != approve_id
    assert handler.audit_log_id == approve_id
