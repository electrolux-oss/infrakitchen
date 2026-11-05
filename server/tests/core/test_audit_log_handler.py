from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

import core.audit_logs.handler as handler_mod
from core.audit_logs.handler import fail_unfinished_audit_log_execution


@pytest.fixture
def audit_log(monkeypatch):
    log = SimpleNamespace(action_metadata=None)
    session = Mock()
    session.get = AsyncMock(return_value=log)
    session.commit = AsyncMock()

    @asynccontextmanager
    async def get_async_session():
        yield session

    monkeypatch.setattr(handler_mod, "get_async_session", get_async_session)
    return log


async def test_running_execution_is_failed_keeping_worker_details(audit_log):
    audit_log.action_metadata = {
        "other": "kept",
        "execution": {"status": "running", "worker": "w-1", "started_at": "2026-11-04T13:00:00+00:00"},
    }

    await fail_unfinished_audit_log_execution("id", "Worker lost (lease expired)")

    execution = audit_log.action_metadata["execution"]
    assert audit_log.action_metadata["other"] == "kept"
    assert execution["status"] == "failed"
    assert execution["error"] == "Worker lost (lease expired)"
    assert execution["worker"] == "w-1"
    assert execution["duration_seconds"] > 0
    assert "finished_at" in execution


async def test_finished_execution_is_left_unchanged(audit_log):
    execution = {"status": "success", "worker": "w-1"}
    audit_log.action_metadata = {"execution": execution}

    await fail_unfinished_audit_log_execution("id", "Worker lost (lease expired)")

    assert audit_log.action_metadata["execution"] == execution
