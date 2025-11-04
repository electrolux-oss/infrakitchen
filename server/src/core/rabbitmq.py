import logging
import os
from typing import Self

from aio_pika import DeliveryMode, Message, connect_robust
from aio_pika.abc import AbstractChannel, AbstractConnection, AbstractExchange
from pamqp.commands import Basic

from .base_models import MessageModel

logger = logging.getLogger("rabbitmq_core")


class RabbitMQConnection:
    """
    Represents a connection to RabbitMQ.

    This class provides a singleton instance of RabbitMQ connection and methods to initialize, check connection status,
    close the connection, and get a channel.

    Attributes:
        _instance (RabbitMQConnection): The singleton instance of RabbitMQConnection.
        connection (AbstractConnection): The RabbitMQ connection object.

    Methods:
        __new__(): Creates a new instance of RabbitMQConnection if it doesn't exist.
        __aenter__(): Asynchronous context manager entry point.
        __aexit__(): Asynchronous context manager exit point.
        init(): Initializes the RabbitMQ connection.
        is_connected(): Checks if the RabbitMQ connection is established.
        close(): Closes the RabbitMQ connection.
        get_channel(): Returns a channel from the RabbitMQ connection.

    """

    _instance: Self | None = None
    connection: AbstractConnection | None = None
    channel: AbstractChannel | None = None

    def __new__(cls):
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def __aenter__(self):
        if not self.is_connected():
            await self.init()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def init(self):
        """
        Initializes the RabbitMQ connection.

        This method establishes a connection to RabbitMQ using the BROKER_URL environment variable.

        """
        self.connection = await connect_robust(os.getenv("BROKER_URL"))

    def is_connected(self):
        """
        Checks if the RabbitMQ connection is established.

        Returns:
            bool: True if the connection is established, False otherwise.

        """
        return self.connection is not None

    async def close(self):
        """
        Closes the RabbitMQ connection.

        This method closes the RabbitMQ connection if it is established.

        """
        if self.is_connected():
            assert self.connection is not None
            await self.connection.close()
            self.connection = None

    async def get_channel(self):
        """
        Returns a channel from the RabbitMQ connection.

        Returns:
            Channel: The RabbitMQ channel object if the connection is established, None otherwise.

        """
        if self.is_connected():
            if self.channel:
                return self.channel
            else:
                assert self.connection is not None
                self.channel = await self.connection.channel()
                return self.channel

        return None

    @staticmethod
    async def publish_and_handle_confirm(exchange: AbstractExchange, routing_key, message_body, confirm: bool = False):
        confirmation = await exchange.publish(
            Message(
                message_body,
                content_type="json",
                delivery_mode=DeliveryMode.PERSISTENT,
            ),
            routing_key=routing_key,
        )

        if confirm and not isinstance(confirmation, Basic.Ack):
            logger.error(f"Message to '{routing_key}' was not acknowledged by broker!")

    @staticmethod
    async def send_message(message: MessageModel, confirm: bool = False):
        async with RabbitMQConnection() as connection:
            channel = await connection.get_channel()
            if channel is None:
                raise RuntimeError("Failed to get a valid RabbitMQ channel")
            if not message.exchange:
                raise ValueError("Exchange is required")

            exchange = await channel.declare_exchange(
                message.exchange,
                message.exchange_type,
                durable=True,
                auto_delete=False,
            )

            await RabbitMQConnection.publish_and_handle_confirm(
                exchange,
                message.routing_key,
                message.to_bytes(),
                confirm=confirm,
            )
