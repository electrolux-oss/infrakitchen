import asyncio
import json
from typing import Any

import pytest

from core import pubsub
from core.pubsub import MAX_PAYLOAD_BYTES, PayloadTooLarge, PubSubHub, encode


def payload(topic: str, data: dict[str, Any]) -> str:
    return json.dumps({"t": topic, "s": 0, "d": data})


@pytest.fixture
def hub(monkeypatch) -> PubSubHub:
    hub = PubSubHub(queue_size=2)
    # Unit tests feed payloads straight to dispatch instead of listening on Postgres
    monkeypatch.setattr(hub, "_ensure_listener", lambda: None)
    return hub


class TestEncode:
    def test_identical_messages_get_distinct_payloads(self):
        # Postgres would deliver identical notifications of one transaction only once
        assert encode("logs.resource.1", {"data": "\n"}) != encode("logs.resource.1", {"data": "\n"})

    def test_keeps_unicode_unescaped(self):
        assert "✓" in encode("events", {"msg": "✓"})

    async def test_rejects_oversized_payload_before_touching_the_db(self):
        with pytest.raises(PayloadTooLarge):
            await pubsub.publish("events", {"body": "x" * MAX_PAYLOAD_BYTES})


class TestHub:
    async def test_delivers_to_subscribers_of_the_topic_only(self, hub):
        async with hub.subscribe("events") as events, hub.subscribe("logs.resource.1") as logs:
            hub.dispatch(payload("events", {"id": "1"}))

            assert await asyncio.wait_for(anext(events), 1) == {"id": "1"}
            with pytest.raises(TimeoutError):
                _ = await asyncio.wait_for(anext(logs), 0.05)

    async def test_fans_out_to_every_subscriber(self, hub):
        async with hub.subscribe("events") as first, hub.subscribe("events") as second:
            hub.dispatch(payload("events", {"id": "1"}))

            assert await anext(first) == {"id": "1"}
            assert await anext(second) == {"id": "1"}

    async def test_unsubscribes_on_exit(self, hub):
        async with hub.subscribe("events"):
            assert "events" in hub._subscribers
        assert "events" not in hub._subscribers

    async def test_slow_subscriber_loses_oldest_messages(self, hub):
        async with hub.subscribe("events") as events:
            for i in range(3):
                hub.dispatch(payload("events", {"i": i}))

            assert [await anext(events), await anext(events)] == [{"i": 1}, {"i": 2}]

    async def test_ignores_malformed_payloads(self, hub):
        async with hub.subscribe("events") as events:
            hub.dispatch("not json")
            hub.dispatch(json.dumps({"d": {}}))
            hub.dispatch(payload("events", {"ok": True}))

            assert await anext(events) == {"ok": True}
