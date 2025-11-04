import asyncio
import logging
import socket

from aio_pika import ExchangeType
from aio_pika.abc import AbstractChannel, AbstractIncomingMessage
from pamqp import commands as spec
from sqlalchemy.ext.asyncio import AsyncSession

from core.workers.crud import WorkerCRUD
from core.workers.functions import get_host_metadata
from core.workers.service import WorkerService

from .base_models import MessageModel
from .workers import WorkerDTO
from .utils.message_handler import MessageHandler

logger = logging.getLogger("BaseMessagesWorker")


class BaseMessagesWorker:
    def __init__(
        self,
        session: AsyncSession,
        name: str,
        lock: asyncio.Lock,
        logger: logging.Logger = logger,
        exchange_name: str | None = None,
        exchange_type: ExchangeType = ExchangeType.TOPIC,
        exclusive: bool = False,
        durable: bool = False,
        auto_delete: bool = False,
        commit_worker_status: bool = False,
    ) -> None:
        self.session: AsyncSession = session
        self.name: str = name
        self.lock: asyncio.Lock = lock
        self.logger: logging.Logger = logger
        self.exchange_name: str | None = exchange_name
        self.exchange_type: ExchangeType = exchange_type
        self.exclusive: bool = exclusive
        self.durable: bool = durable
        self.commit_worker_status: bool = commit_worker_status
        self.worker_service: WorkerService = WorkerService(crud=WorkerCRUD(session=session))
        if not self.exchange_name:
            raise ValueError("Exchange name is required")

        self.auto_delete: bool = auto_delete
        self.worker: WorkerDTO = WorkerDTO(name=self.name, host=socket.gethostname())

    async def on_failure(self, message: MessageHandler) -> None:
        if message.retries >= message.max_retries:
            self.logger.info("Retries exceeded")
            return

        message.retries += 1

        _ = await message.channel.basic_publish(
            message.raw_body,
            exchange=message.exchange if message.exchange else "",
            routing_key="" if message.routing_key is None else message.routing_key,
            properties=spec.Basic.Properties(
                headers=message.headers,
                delivery_mode=message.delivery_mode,
                content_type=message.content_type,
            ),
        )

        await message.message_original.reject(requeue=False)

    async def process_message(self, message: MessageHandler) -> None:
        assert self.worker.id is not None
        # self.logger.debug(f"Processing message raw: {message}")
        MessageModel.load_from_bytes(message.raw_body)
        # self.logger.debug(f"Processing message: {msg}")
        if self.commit_worker_status:
            await self.worker_service.change_worker_status(self.worker.id, "free")

    async def on_message(self, msg: AbstractIncomingMessage):
        assert self.worker.id is not None
        async with msg.process(ignore_processed=True):
            async with self.lock:
                if self.commit_worker_status:
                    await self.worker_service.change_worker_status(self.worker.id, "busy")
                message = MessageHandler(msg)
                try:
                    await self.process_message(message)
                    if self.commit_worker_status:
                        await self.worker_service.change_worker_status(self.worker.id, "free")
                except Exception as e:
                    if self.commit_worker_status:
                        await self.worker_service.change_worker_status(self.worker.id, "free")
                    logger.error(f"Task failed: {e}")

    async def start(self, rabbitmq_connection, routing_key="broadcast") -> None:
        self.logger.info(f"Perform {self.name} worker connection")

        async with rabbitmq_connection as connection:
            # Creating a channel
            channel: AbstractChannel = await connection.get_channel()

            worker = self

            if not self.exchange_name:
                raise ValueError("Exchange name is required")

            tasks_exchange = await channel.declare_exchange(
                self.exchange_name, self.exchange_type, durable=self.durable, auto_delete=self.auto_delete
            )

            # Declaring queue
            queue = await channel.declare_queue(
                worker.name,
                exclusive=self.exclusive,
                durable=self.durable,
                auto_delete=self.auto_delete,
            )

            # Binding the queue to the exchange
            _ = await queue.bind(
                tasks_exchange,
                routing_key=routing_key,
            )
            consumer_tag = await queue.consume(worker.on_message)
            try:
                # This is the line that keeps the worker alive and is the cancellation point
                await asyncio.Future()
            except asyncio.CancelledError:
                self.logger.info(f"Worker {self.name} received cancellation signal.")

                # Cleanly stop consuming messages
                if consumer_tag:
                    await queue.cancel(consumer_tag)

                raise

    async def register(self):
        self.worker.host_metadata = get_host_metadata()
        self.worker = await self.worker_service.save_worker(self.worker)
        await self.session.commit()

    async def run(self, rabbitmq_connection, routing_key="broadcast") -> None:
        await self.register()
        await asyncio.gather(self.start(rabbitmq_connection, routing_key), self.health_check())

    async def health_check(self):
        while True:
            try:
                # Introduce a 1-minute delay
                await asyncio.sleep(60)

                # Perform health check logic here
                # For example, check if the worker is connected to RabbitMQ
                await self.register()
            except Exception as e:
                self.logger.error(f"Health check failed: {e}")
                raise e
