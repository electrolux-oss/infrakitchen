from fastapi import WebSocket

import logging

from core.singleton_meta import SingletonMeta

logger = logging.getLogger(__name__)


class WebSocketConnectionManager(metaclass=SingletonMeta):
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.debug(f"WebSocket opened, total connections: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket, code: int = 1001):
        if websocket in self.active_connections:
            if websocket.client_state.name != "DISCONNECTED":
                try:
                    await websocket.close(code=code)
                except RuntimeError as e:
                    logger.debug(f"Error closing WebSocket: {e}")
            self.active_connections.remove(websocket)

    async def close_all_connections(self):
        """Closes all active WebSocket connections."""
        logger.info("Closing all active WebSocket connections...")
        for websocket in self.active_connections:
            if not websocket.client_state.name == "DISCONNECTED":
                try:
                    await websocket.close(code=1001, reason="Server shutting down")
                except Exception as e:
                    logger.debug(f"Error closing WebSocket: {e}")
            await self.disconnect(websocket)
