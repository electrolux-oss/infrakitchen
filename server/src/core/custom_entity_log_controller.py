import asyncio
import datetime
import logging
from typing import Any, Literal, Protocol
from uuid import UUID

from core.dependencies import get_async_session
from core.logs.model import Log

import core.pubsub as pubsub

logger = logging.getLogger("entity_logger")

# Room left in a NOTIFY payload for the envelope and the per-batch fields
_LINES_BUDGET = pubsub.MAX_PAYLOAD_BYTES - 1024
# JSON escaping grows a character to at most 6 bytes (\u001b), so this many always fit
_MAX_CHUNK_CHARS = _LINES_BUDGET // 6


def chunk_lines(lines: list[dict[str, Any]], budget: int = _LINES_BUDGET) -> list[list[dict[str, Any]]]:
    """Pack log lines into groups that each fit one NOTIFY payload, keeping their order.

    A line too long for a payload of its own is split into consecutive pieces.
    """
    pieces: list[dict[str, Any]] = []
    for line in lines:
        data: str = line["data"]
        if pubsub.encoded_size(line) <= budget:
            pieces.append(line)
            continue
        for start in range(0, len(data), _MAX_CHUNK_CHARS):
            pieces.append({**line, "data": data[start : start + _MAX_CHUNK_CHARS]})

    chunks: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    size = 0
    for piece in pieces:
        # +1 for the separating comma
        piece_size = pubsub.encoded_size(piece) + 1
        if current and size + piece_size > budget:
            chunks.append(current)
            current, size = [], 0
        current.append(piece)
        size += piece_size
    if current:
        chunks.append(current)
    return chunks


class LoggerProtocol(Protocol):
    def info(self, data: str) -> None: ...
    def warning(self, data: str) -> None: ...
    def error(self, data: str) -> None: ...
    def debug(self, data: str) -> None: ...


class EntityLogger:
    def __init__(
        self,
        entity_name: str,
        entity_id: str | UUID,
        revision_number: int = 1,
        audit_log_id: str | UUID | None = None,
        should_be_expired: bool = False,
        trace_id: str | None = None,
    ):
        self.bulk_logs_operations: list[Log] = []
        # Lines saved but not yet streamed to live subscribers
        self.pending_lines: list[dict[str, Any]] = []
        self.entity_name: str | None = entity_name
        self.entity_id: str | UUID = entity_id
        self.revision_number: int = revision_number
        self.execution_start: int = int(datetime.datetime.now().timestamp())
        self.audit_log_id: str | UUID | None = audit_log_id
        self.trace_id: str | None = trace_id
        self._save_lock = asyncio.Lock()
        # execution result details stored in the audit log metadata when the task is done
        self.result: dict[str, Any] = {}
        # setup ttl for logs to be expired ex. dry run logs
        self.expire_at: datetime.datetime | None = None
        if should_be_expired:
            self.expire_at = datetime.datetime.now() + datetime.timedelta(days=5)

    def make_expired(self):
        self.expire_at = datetime.datetime.now() + datetime.timedelta(days=5)

    def add_result(self, **data: Any):
        self.result.update({key: value for key, value in data.items() if value is not None})

    def add_log_header(self, data: str):
        self._add_marker_log(data, "header")

    def add_log_footer(self, status: str):
        duration = int(datetime.datetime.now().timestamp()) - self.execution_start
        self._add_marker_log(f"Status: {status} Duration: {duration}s", "footer")

    def _add_marker_log(self, data: str, level: Literal["header", "footer"]):
        log = Log(
            entity=self.entity_name,
            entity_id=self.entity_id,
            revision=self.revision_number,
            data=data,
            level=level,
            created_at=datetime.datetime.now(datetime.UTC),
            execution_start=self.execution_start,
            audit_log_id=self.audit_log_id,
            expire_at=self.expire_at,
            trace_id=self.trace_id,
        )

        self.bulk_logs_operations.append(log)

    def append_log(self, data: str, level: Literal["info", "warn", "error", "debug"] = "info"):
        if data == "":
            return
        created_at = datetime.datetime.now(datetime.UTC)
        log = Log(
            entity=self.entity_name,
            entity_id=self.entity_id,
            revision=self.revision_number,
            data=data,
            level=level,
            created_at=created_at,
            execution_start=self.execution_start,
            audit_log_id=self.audit_log_id,
            expire_at=self.expire_at,
            trace_id=self.trace_id,
        )
        self.bulk_logs_operations.append(log)
        self.pending_lines.append({"data": data, "level": level, "created_at": created_at.isoformat()})

    async def save_if_more_than(self, count: int):
        # Return early if already saving to avoid creating unnecessary lock contention
        if self._save_lock.locked():
            return
        if len(self.bulk_logs_operations) > count:
            await self.save_log()

    async def save_log(self):
        async with self._save_lock:
            if self.bulk_logs_operations:
                async with get_async_session() as session:
                    session.add_all(self.bulk_logs_operations)
                    self.bulk_logs_operations = []
                    await session.commit()

            await self.send_messages()

    async def send_messages(self):
        """Stream the pending lines to live subscribers, a few lines per NOTIFY."""
        lines, self.pending_lines = self.pending_lines, []
        if not lines:
            return
        batch = {
            "entity": self.entity_name,
            "entity_id": str(self.entity_id),
            "revision": self.revision_number,
            "execution_start": self.execution_start,
            "audit_log_id": str(self.audit_log_id) if self.audit_log_id else None,
            "trace_id": self.trace_id,
        }
        topic = pubsub.logs_topic(self.entity_name or "", self.entity_id)
        try:
            await pubsub.publish_many((topic, {**batch, "lines": chunk}) for chunk in chunk_lines(lines))
        except Exception as e:
            # The lines are already saved; only the live tail misses them
            logger.warning(f"Failed to stream {len(lines)} log line(s) for {topic}: {e}")

    def add_divider(self):
        self.append_log("\n" + "=" * 100 + "\n")

    def add_dry_run(self):
        self.append_log(
            """
        ██████╗ ██████╗ ██╗   ██╗    ██████╗ ██╗   ██╗███╗   ██╗
        ██╔══██╗██╔══██╗╚██╗ ██╔╝    ██╔══██╗██║   ██║████╗  ██║
        ██║  ██║██████╔╝ ╚████╔╝     ██████╔╝██║   ██║██╔██╗ ██║
        ██║  ██║██╔══██╗  ╚██╔╝      ██╔══██╗██║   ██║██║╚██╗██║
        ██████╔╝██║  ██║   ██║       ██║  ██║╚██████╔╝██║ ╚████║
        ╚═════╝ ╚═╝  ╚═╝   ╚═╝       ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
        """
        )

    def info(self, data: str):
        logger.info(data)
        self.append_log(data, "info")

    def warning(self, data: str):
        logger.warning(data)
        self.append_log(data, "warn")

    def error(self, data: str):
        logger.error(data)
        self.append_log(data, "error")

    def debug(self, data: str):
        logger.debug(data)


CustomEntityLoggerType = LoggerProtocol
