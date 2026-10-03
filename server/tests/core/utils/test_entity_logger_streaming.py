from typing import Any
from unittest.mock import AsyncMock

import core.custom_entity_log_controller as log_controller_mod
from core.custom_entity_log_controller import EntityLogger, chunk_lines
from core.pubsub import MAX_PAYLOAD_BYTES, encode


def line(data: str) -> dict[str, Any]:
    return {"data": data, "level": "info", "created_at": "2026-10-01T00:00:00+00:00"}


class TestChunkLines:
    def test_small_lines_share_one_chunk(self):
        lines = [line(f"line {i}") for i in range(10)]
        assert chunk_lines(lines) == [lines]

    def test_chunks_respect_budget_and_keep_order(self):
        lines = [line(f"{i:04d}" + "x" * 300) for i in range(100)]

        chunks = chunk_lines(lines, budget=2000)

        assert len(chunks) > 1
        assert [entry for chunk in chunks for entry in chunk] == lines

    def test_oversized_line_is_split_into_pieces(self):
        # ANSI escapes grow 6x when JSON-encoded, the worst case for the payload size
        data = "\x1b[0m" * 5000
        chunks = chunk_lines([line(data)])

        assert "".join(piece["data"] for chunk in chunks for piece in chunk) == data
        for chunk in chunks:
            assert len(encode("logs.resource.1", {"lines": chunk}).encode()) < MAX_PAYLOAD_BYTES


class TestSendMessages:
    async def test_publishes_lines_with_batch_fields(self, monkeypatch):
        published: list[tuple[str, dict[str, Any]]] = []

        async def publish_many(messages):
            published.extend(messages)

        monkeypatch.setattr(log_controller_mod.pubsub, "publish_many", publish_many)
        logger = EntityLogger("resource", "r1", revision_number=3, audit_log_id="a1", trace_id="t1")
        logger.info("hello")
        logger.error("boom")

        await logger.send_messages()

        assert len(published) == 1
        topic, data = published[0]
        assert topic == "logs.resource.r1"
        assert data["revision"] == 3
        assert data["execution_start"] == logger.execution_start
        assert (data["audit_log_id"], data["trace_id"]) == ("a1", "t1")
        assert [(entry["data"], entry["level"]) for entry in data["lines"]] == [("hello", "info"), ("boom", "error")]
        assert logger.pending_lines == []

    async def test_publish_failure_is_not_raised(self, monkeypatch):
        monkeypatch.setattr(log_controller_mod.pubsub, "publish_many", AsyncMock(side_effect=OSError("db down")))
        logger = EntityLogger("resource", "r1")
        logger.info("hello")

        await logger.send_messages()

        assert logger.pending_lines == []
