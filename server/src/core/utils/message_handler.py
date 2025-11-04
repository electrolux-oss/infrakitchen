import json

from aio_pika.abc import AbstractIncomingMessage


class MessageHandler:
    def __init__(self, message: AbstractIncomingMessage) -> None:
        self.message_original: AbstractIncomingMessage = message
        self.exchange = message.exchange
        self.channel = message.channel
        self.content_type = message.content_type
        self.raw_body = message.body
        self.routing_key = message.routing_key
        self.delivery_mode = message.delivery_mode

        if self.content_type == "json":
            self.body = json.loads(message.body.decode())
        else:
            self.body = message.body.decode()
        self.headers = message.headers

    def __str__(self) -> str:
        return f"Exchange: {self.exchange}, Routing Key: {self.routing_key}, Body: {self.body}, Delivery Mode: {self.delivery_mode}"  # noqa

    @property
    def retries(self) -> int:
        ret = self.headers.get("retries", 0)
        if isinstance(ret, bytes):
            return int(ret.decode())
        elif isinstance(ret, str):
            return int(ret)
        elif isinstance(ret, int):
            return ret
        else:
            return 0

    @retries.setter
    def retries(self, value: int) -> None:
        self.headers.update({"retries": value})

    @property
    def max_retries(self) -> int:
        ret = self.headers.get("max_retries", 3)
        if isinstance(ret, bytes):
            return int(ret.decode())
        elif isinstance(ret, str):
            return int(ret)
        elif isinstance(ret, int):
            return ret
        else:
            return 0

    @max_retries.setter
    def max_retries(self, value) -> None:
        self.headers.update({"max_retries": value})

    @property
    def delay(self) -> int:
        ret = self.headers.get("x-delay", 0)
        if isinstance(ret, bytes):
            return int(ret.decode())
        elif isinstance(ret, str):
            return int(ret)
        elif isinstance(ret, int):
            return ret
        else:
            return 0

    @delay.setter
    def delay(self, value) -> None:
        self.headers.update({"x-delay": value})
