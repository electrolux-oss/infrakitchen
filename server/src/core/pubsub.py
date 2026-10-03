"""Process-wide publish/subscribe over Postgres LISTEN/NOTIFY.

Every message goes to one NOTIFY channel as ``{"t": <topic>, "s": <seq>, "d": <data>}``.
Each process holds a single LISTEN connection (``PubSubHub``) and fans incoming
messages out to local subscribers of the exact topic, so a WebSocket subscription
costs an ``asyncio.Queue`` instead of a broker queue or a DB connection.

Delivery is at-most-once, like the broker it replaces: subscribers miss messages
published while their process is disconnected. Durable work belongs in the task
queue or the notification outbox.
"""

import asyncio
import itertools
import json
import logging
from collections import defaultdict
from collections.abc import AsyncIterator, Iterable
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession
from sqlalchemy.types import Text

from core.db_engine import engine
from core.utils.json_encoder import JsonEncoder

logger = logging.getLogger(__name__)

PUBSUB_CHANNEL = "ik_pubsub"
# Postgres rejects NOTIFY payloads of 8000 bytes or more; leave room for the envelope
MAX_PAYLOAD_BYTES = 7900

# Entity changes and reload signals, broadcast to every process
EVENTS_TOPIC = "events"
# Wakes up notification dispatchers when new outbox rows are committed
NOTIFICATION_OUTBOX_TOPIC = "notification_outbox"


def logs_topic(entity_name: str, entity_id: Any) -> str:
    return f"logs.{entity_name}.{entity_id}"


def in_app_notifications_topic(user_id: Any) -> str:
    return f"notifications.in_app.{user_id}"


class PayloadTooLarge(ValueError):
    pass


# Postgres drops identical notifications sent in one transaction, so each one gets a sequence number
_sequence = itertools.count()

_NOTIFY_MANY = text("SELECT pg_notify(:channel, payload) FROM unnest(:payloads) AS payload").bindparams(
    bindparam("payloads", type_=ARRAY(Text()))
)


def encode(topic: str, data: dict[str, Any]) -> str:
    return json.dumps({"t": topic, "s": next(_sequence), "d": data}, cls=JsonEncoder, ensure_ascii=False)


def encoded_size(data: Any) -> int:
    """Size ``data`` takes inside a NOTIFY payload."""
    return len(json.dumps(data, cls=JsonEncoder, ensure_ascii=False).encode())


def _encode_all(messages: Iterable[tuple[str, dict[str, Any]]]) -> list[str]:
    payloads = [encode(topic, data) for topic, data in messages]
    for payload in payloads:
        if len(payload.encode()) > MAX_PAYLOAD_BYTES:
            raise PayloadTooLarge(f"NOTIFY payload of {len(payload.encode())} bytes exceeds {MAX_PAYLOAD_BYTES}")
    return payloads


async def notify_in(connection: AsyncConnection | AsyncSession, messages: Iterable[tuple[str, dict[str, Any]]]) -> None:
    """Queue messages on the caller's transaction; Postgres delivers them when it commits."""
    payloads = _encode_all(messages)
    if payloads:
        _ = await connection.execute(_NOTIFY_MANY, {"channel": PUBSUB_CHANNEL, "payloads": payloads})


async def publish_many(messages: Iterable[tuple[str, dict[str, Any]]]) -> None:
    """Publish messages in one round trip and one transaction, preserving order."""
    payloads = _encode_all(messages)
    if not payloads:
        return
    async with engine.begin() as connection:
        _ = await connection.execute(_NOTIFY_MANY, {"channel": PUBSUB_CHANNEL, "payloads": payloads})


async def publish(topic: str, data: dict[str, Any]) -> None:
    await publish_many([(topic, data)])


class PubSubHub:
    """Single LISTEN connection per process, fanned out to in-process subscribers.

    The listener starts with the first subscription and reconnects with backoff.
    A subscriber that falls behind by ``queue_size`` messages loses the oldest ones
    rather than holding the listener back.
    """

    def __init__(self, channel: str = PUBSUB_CHANNEL, queue_size: int = 1000, ping_seconds: float = 30.0):
        self.channel: str = channel
        self.queue_size: int = queue_size
        self.ping_seconds: float = ping_seconds
        self._subscribers: defaultdict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._listener: asyncio.Task[None] | None = None

    @asynccontextmanager
    async def subscribe(self, topic: str) -> AsyncIterator[AsyncIterator[dict[str, Any]]]:
        """Receive the data of every message published to ``topic`` while the context is open."""
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=self.queue_size)
        self._subscribers[topic].add(queue)
        self._ensure_listener()
        try:
            yield self._iterate(queue)
        finally:
            subscribers = self._subscribers.get(topic)
            if subscribers is not None:
                subscribers.discard(queue)
                if not subscribers:
                    del self._subscribers[topic]

    @staticmethod
    async def _iterate(queue: asyncio.Queue[dict[str, Any]]) -> AsyncIterator[dict[str, Any]]:
        while True:
            yield await queue.get()

    def dispatch(self, payload: str) -> None:
        """Deliver one raw NOTIFY payload to the subscribers of its topic."""
        try:
            message = json.loads(payload)
            topic: str = message["t"]
            data: dict[str, Any] = message["d"]
        except (ValueError, KeyError, TypeError):
            logger.warning(f"Ignoring malformed pubsub payload: {payload[:200]}")
            return

        for queue in self._subscribers.get(topic, ()):
            if queue.full():
                _ = queue.get_nowait()
                logger.warning(f"Subscriber of {topic} is falling behind, dropped its oldest message")
            queue.put_nowait(data)

    def _ensure_listener(self) -> None:
        if self._listener is None or self._listener.done():
            self._listener = asyncio.get_running_loop().create_task(self._listen_loop())

    async def _listen_loop(self) -> None:
        def on_notify(_connection: Any, _pid: int, _channel: str, payload: str) -> None:
            self.dispatch(payload)

        backoff = 1.0
        while True:
            try:
                async with engine.connect() as connection:
                    raw = await connection.get_raw_connection()
                    driver = raw.driver_connection
                    if driver is None:
                        raise RuntimeError("No driver connection available for LISTEN")
                    await driver.add_listener(self.channel, on_notify)
                    logger.info(f"Listening for pubsub messages on {self.channel}")
                    backoff = 1.0
                    try:
                        # A dead connection delivers nothing without raising, so check it periodically
                        while True:
                            await asyncio.sleep(self.ping_seconds)
                            _ = await driver.execute("SELECT 1")
                    finally:
                        await driver.remove_listener(self.channel, on_notify)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning(f"Pubsub listener stopped: {e}, reconnecting in {backoff:.0f}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)

    async def close(self) -> None:
        if self._listener is not None:
            _ = self._listener.cancel()
            try:
                await self._listener
            except (asyncio.CancelledError, Exception):
                pass
            self._listener = None


hub = PubSubHub()
