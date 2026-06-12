import asyncio
import json
import logging
from typing import Any
import aio_pika

from core.casbin.enforcer import CasbinEnforcer
from core.feature_flags.feature_flag_manager import reload_feature_flags_configs
from core.rabbitmq import RabbitMQConnection

logger = logging.getLogger(__name__)


async def rabbitmq_consumer():
    async def callback(message: aio_pika.abc.AbstractIncomingMessage) -> None:
        async with message.process(ignore_processed=True):
            msg = message.body.decode()
            decoded_json_message: dict[str, Any] = json.loads(msg)

            if decoded_json_message.get("_metadata", {}).get("event") == "reload_feature_flags_configs":
                logger.debug('Got "reload all Feature Flag configs" event')
                await reload_feature_flags_configs()

            if decoded_json_message.get("_metadata", {}).get("event") == "reload_policies":
                logger.debug("Got event to reload policies")
                enforcer = CasbinEnforcer().enforcer
                if not enforcer:
                    raise ValueError("Enforcer is not initialized")
                await enforcer.load_policy()
            else:
                logger.debug(f"Sending message to eventstream: {msg}")

    async with RabbitMQConnection() as connection:
        channel = await connection.get_channel()
        if channel is None:
            raise RuntimeError("Failed to create a channel. Connection might not be established.")

        raw_messages_exchange = await channel.declare_exchange(
            "ik_raw_messages",
            aio_pika.ExchangeType.TOPIC,
            auto_delete=False,
            durable=True,
        )

        events_exchange = await channel.declare_exchange(
            "ik_event_messages",
            aio_pika.ExchangeType.FANOUT,
            auto_delete=False,
            durable=True,
        )
        _ = await events_exchange.bind(raw_messages_exchange, routing_key="events.*.*")

        # Declaring a queue
        queue = await channel.declare_queue(name="event_messages_consumer", auto_delete=False)

        # Binding the queue to the exchange
        _ = await queue.bind(events_exchange)

        consumer_tag = await queue.consume(callback)
        logger.info("Subscribed RabbitMQ ik_event_messages")

        try:
            # This is the line that keeps the worker alive and is the cancellation point
            await asyncio.Future()
        except asyncio.CancelledError:
            # Cleanly stop consuming messages
            if consumer_tag:
                await queue.cancel(consumer_tag)

            raise


async def start_rabbitmq_consumer():
    try:
        await rabbitmq_consumer()
    except Exception as e:
        logger.error(f"RabbitMQ consumer stopped unexpectedly: {e}, restrating in 5 seconds")
        await asyncio.sleep(5)  # Wait before restarting
        await start_rabbitmq_consumer()
