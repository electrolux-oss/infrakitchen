import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

import core.pubsub as pubsub
from core.casbin.enforcer import CasbinEnforcer
from core.feature_flags.feature_flag_manager import reload_feature_flags_configs

logger = logging.getLogger(__name__)

EventHandler = Callable[[str], Awaitable[None]]


async def consume_events(handler: EventHandler, name: str, restart_delay: float = 5.0) -> None:
    """Pass the name of every event on the events topic to ``handler``, until cancelled.

    Each process subscribes on its own, so broadcasts like ``reload_policies``
    reach every API replica and scheduler. A failing handler is logged and the
    subscription carries on; if the subscription itself fails it is re-opened.
    """
    while True:
        try:
            async with pubsub.hub.subscribe(pubsub.EVENTS_TOPIC) as messages:
                logger.info(f"{name} subscribed to {pubsub.EVENTS_TOPIC}")
                async for message in messages:
                    metadata: dict[str, Any] = message.get("_metadata") or {}
                    event = metadata.get("event")
                    if not event:
                        continue
                    try:
                        await handler(str(event))
                    except Exception as e:
                        logger.error(f"{name} failed to handle event {event}: {e}", exc_info=True)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"{name} stopped unexpectedly: {e}, restarting in {restart_delay:.0f} seconds")
            await asyncio.sleep(restart_delay)


async def handle_reload_event(event: str) -> None:
    if event == "reload_feature_flags_configs":
        logger.debug('Got "reload all Feature Flag configs" event')
        await reload_feature_flags_configs()
    elif event == "reload_policies":
        logger.debug("Got event to reload policies")
        enforcer = CasbinEnforcer().enforcer
        if not enforcer:
            raise ValueError("Enforcer is not initialized")
        await enforcer.load_policy()


async def start_event_consumer() -> None:
    await consume_events(handle_reload_event, name="API event consumer")
