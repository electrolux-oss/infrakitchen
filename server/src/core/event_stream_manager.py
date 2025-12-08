import asyncio
import json
import logging
from typing import Any
import aio_pika

from core.singleton_meta import SingletonMeta

from .casbin.enforcer import CasbinEnforcer
from .feature_flags.feature_flag_manager import reload_feature_flags_configs
from .rabbitmq import RabbitMQConnection

logger = logging.getLogger(__name__)


class ConnectionManager(metaclass=SingletonMeta):
    def __init__(self):
        self.active_queues: dict[str, asyncio.Queue[str]] = {}

    async def get_queue(self, user_id: str) -> asyncio.Queue[str]:
        if user_id not in self.active_queues:
            self.active_queues[user_id] = asyncio.Queue(maxsize=10)
        return self.active_queues[user_id]

    def remove_queue(self, user_id: str):
        if user_id in self.active_queues:
            del self.active_queues[user_id]


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


async def rabbitmq_log_consumer(entity_name: str, entity_id: str, connection_id: str):
    async with RabbitMQConnection() as connection:
        channel = await connection.get_channel()
        cm = ConnectionManager()
        if channel is None:
            raise RuntimeError("Failed to create a channel. Connection might not be established.")
        try:
            raw_messages_exchange = await channel.declare_exchange(
                "ik_raw_messages",
                aio_pika.ExchangeType.TOPIC,
                auto_delete=False,
                durable=True,
            )

            log_exchange = await channel.declare_exchange(
                f"ik_log_messages_{entity_id}",
                aio_pika.ExchangeType.FANOUT,
                auto_delete=True,
                durable=True,
            )

            routing_key = f"logs.{entity_name}.{entity_id}"
            _ = await log_exchange.bind(raw_messages_exchange, routing_key=routing_key)

            # Declaring a temp queue
            queue = await channel.declare_queue(exclusive=True, auto_delete=True)

            # Binding the queue to the exchange
            _ = await queue.bind(log_exchange)

            logger.info(f"Subscribed to RabbitMQ ik_log_messages for {entity_id}")

            entity_queue = await cm.get_queue(f"{str(entity_id)}_{connection_id}")

            async with queue.iterator(no_ack=True) as q:
                async for message in q:
                    msg = message.body.decode()
                    await entity_queue.put(msg)
        finally:
            logger.debug("Closing RabbitMQ logs connection")
            entity_queue = cm.remove_queue(str(entity_id))


async def rabbitmq_events_consumer(user_id: str, connection_id: str):
    async with RabbitMQConnection() as connection:
        cm = ConnectionManager()
        channel = await connection.get_channel()
        if channel is None:
            raise RuntimeError("Failed to create a channel. Connection might not be established.")
        try:
            raw_messages_exchange = await channel.declare_exchange(
                "ik_raw_messages",
                aio_pika.ExchangeType.TOPIC,
                auto_delete=False,
                durable=True,
            )

            log_exchange = await channel.declare_exchange(
                "ik_event_messages",
                aio_pika.ExchangeType.FANOUT,
                durable=True,
                auto_delete=False,
            )
            _ = await log_exchange.bind(raw_messages_exchange, routing_key=user_id)

            # Declaring a temp queue
            queue = await channel.declare_queue(exclusive=True, auto_delete=True)

            # Binding the queue to the exchange
            _ = await queue.bind(log_exchange)
            logger.info(f"Subscribed to RabbitMQ ik_log_messages for User {user_id}")

            entity_queue = await cm.get_queue(str(f"{user_id}_{connection_id}"))
            async with queue.iterator(no_ack=True) as q:
                async for message in q:
                    msg = message.body.decode()
                    await entity_queue.put(msg)
        finally:
            logger.debug("Closing RabbitMQ logs connection")


async def rabbitmq_notifications_consumer(user_id: str, connection_id: str):
    async with RabbitMQConnection() as connection:
        cm = ConnectionManager()
        channel = await connection.get_channel()
        if channel is None:
            raise RuntimeError("Failed to create a channel. Connection might not be established.")
        try:
            raw_messages_exchange = await channel.declare_exchange(
                "ik_raw_messages",
                aio_pika.ExchangeType.TOPIC,
                auto_delete=False,
                durable=True,
            )

            queue = await channel.declare_queue(exclusive=True, auto_delete=True)

            await queue.bind(raw_messages_exchange, routing_key=f"notifications.*.{user_id}")
            user_queue = await cm.get_queue(f"{str(user_id)}_{connection_id}")

            logger.debug(
                f"Subscribed to RabbitMQ notifications for User {user_id} with pattern notifications.*.{user_id}"
            )

            async with queue.iterator(no_ack=True) as q:
                async for message in q:
                    msg = message.body.decode()
                    logger.debug(f"Consuming notification message for user {user_id}:", msg)
                    await user_queue.put(msg)
        finally:
            logger.debug("Closing RabbitMQ notifications connection")
            cm.remove_queue(f"{str(user_id)}_{connection_id}")
