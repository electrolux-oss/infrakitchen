import asyncio
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock

from core.utils import event_stream_manager


def fake_subscribe(messages: list[dict[str, Any]]):
    @asynccontextmanager
    async def subscribe(_topic: str):
        async def iterate():
            for message in messages:
                yield message
            # Keep the subscription open like a real one
            await asyncio.Future()

        yield iterate()

    return subscribe


class TestConsumeEvents:
    async def test_passes_event_names_and_survives_handler_errors(self, monkeypatch):
        messages = [
            {"_metadata": {"event": "reload_policies"}},
            {"id": "1", "_metadata": {}},
            {"_metadata": {"event": "reload_scheduler_jobs"}},
        ]
        monkeypatch.setattr(event_stream_manager.pubsub.hub, "subscribe", fake_subscribe(messages))
        handler = AsyncMock(side_effect=[RuntimeError("boom"), None])

        task = asyncio.create_task(event_stream_manager.consume_events(handler, name="test"))
        await asyncio.sleep(0.05)
        _ = task.cancel()
        _ = await asyncio.gather(task, return_exceptions=True)

        assert [call.args[0] for call in handler.await_args_list] == ["reload_policies", "reload_scheduler_jobs"]
