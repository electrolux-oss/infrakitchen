import asyncio
import logging
from uuid import uuid4
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, WebSocketException, status
from pydantic import BaseModel
from core.config import InfrakitchenConfig
from core.event_stream_manager import (
    ConnectionManager,
    rabbitmq_events_consumer,
    rabbitmq_log_consumer,
    rabbitmq_notifications_consumer,
)
from core.sso.functions import validate_token
from core.users.model import UserDTO
from core.utils.websocket_manager import WebSocketConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws")

RABBITMQ_QUEUE_TIMEOUT = 600
AUTH_TIMEOUT = 1


class WebSocketMessageModel(BaseModel):
    type: str
    token: str | None = None


def get_user_from_token(token: str) -> UserDTO | None:
    decoded_token = validate_token(token, alg="HS256", audience="infrakitchen")
    if not decoded_token:
        return None
    user_id = decoded_token.get("pld", {}).get("id")
    assert user_id is not None, "User ID not found in token claims"
    user = UserDTO.model_validate(decoded_token["pld"])
    return user


async def websocket_authenticate(websocket: WebSocket) -> UserDTO:
    websocket_manager = WebSocketConnectionManager()
    try:
        msg = await websocket.receive_text()
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)
        raise

    try:
        ws_message = WebSocketMessageModel.model_validate_json(msg)
        if not ws_message.token:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        user = get_user_from_token(ws_message.token)
        if not user:
            await websocket_manager.disconnect(websocket)
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return user
    except Exception as e:
        logger.error(f"Error validating WebSocket message: {e}")
        await websocket_manager.disconnect(websocket)
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token") from e


@router.websocket("/notifications")
async def websocket_notifications_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications.
    1. Accept the WebSocket connection.
    2. Waiting for a message containing the token for authentication.
    3. Reject the connection if authentication fails.
    4. Listen for messages from RabbitMQ and send them to the client.
    """
    if InfrakitchenConfig().websocket is False:
        await websocket.close(code=1008)
        return

    websocket_manager = WebSocketConnectionManager()
    connection_id = str(uuid4())
    await websocket_manager.connect(websocket)
    try:
        user = await asyncio.wait_for(websocket_authenticate(websocket), timeout=AUTH_TIMEOUT)
    except TimeoutError:
        await websocket_manager.disconnect(websocket, code=status.WS_1008_POLICY_VIOLATION)
        return
    except WebSocketDisconnect:
        logger.debug("WebSocket disconnected during authentication")
        return

    cm = ConnectionManager()
    user_queue = await cm.get_queue(f"{str(user.id)}_{connection_id}")

    consumer_task = asyncio.create_task(rabbitmq_notifications_consumer(str(user.id), connection_id))
    code = status.WS_1000_NORMAL_CLOSURE
    try:
        while True:
            message = await asyncio.wait_for(user_queue.get(), timeout=RABBITMQ_QUEUE_TIMEOUT)
            await websocket.send_text(message)

    except TimeoutError:
        code = 3008
    except WebSocketDisconnect:
        logger.debug(f"WebSocket disconnected for user {user.id}")
    except Exception as e:
        code = status.WS_1011_INTERNAL_ERROR
        logger.debug(f"An error occurred in the WebSocket loop: {e}")
    finally:
        logger.debug(f"Cleaning up resources for user {user.id}")
        consumer_task.cancel()
        await websocket_manager.disconnect(websocket, code=code)
        try:
            await asyncio.gather(consumer_task)
        except asyncio.CancelledError:
            logger.debug("Tasks cancelled successfully.")

        cm.remove_queue(f"{str(user.id)}_{connection_id}")
    logger.debug(f"WebSocket connection closed for user {user.id}")


@router.websocket("/logs/{entity_name}/{entity_id}")
async def websocket_logs_endpoint(websocket: WebSocket, entity_id: str, entity_name: str):
    if InfrakitchenConfig().websocket is False:
        await websocket.close(code=1008)
        return

    if not entity_id or not entity_name:
        await websocket.close(code=1008)
        return

    websocket_manager = WebSocketConnectionManager()
    connection_id = str(uuid4())
    await websocket_manager.connect(websocket)
    try:
        _ = await asyncio.wait_for(websocket_authenticate(websocket), timeout=AUTH_TIMEOUT)
    except TimeoutError:
        await websocket_manager.disconnect(websocket, code=status.WS_1008_POLICY_VIOLATION)
        return
    except WebSocketDisconnect:
        logger.debug("WebSocket disconnected during authentication")
        return

    cm = ConnectionManager()
    entity_queue = await cm.get_queue(f"{str(entity_id)}_{connection_id}")

    consumer_task = asyncio.create_task(rabbitmq_log_consumer(entity_name, entity_id, connection_id))
    code = status.WS_1000_NORMAL_CLOSURE
    try:
        while True:
            message = await asyncio.wait_for(entity_queue.get(), timeout=RABBITMQ_QUEUE_TIMEOUT)
            await websocket.send_text(message)
    except TimeoutError:
        code = 3008
    except WebSocketDisconnect:
        logger.debug(f"WebSocket disconnected for entity {entity_id}")
    except Exception as e:
        code = status.WS_1011_INTERNAL_ERROR
        logger.debug(f"An error occurred in the WebSocket loop: {e}")
    finally:
        consumer_task.cancel()
        await websocket_manager.disconnect(websocket, code=code)
        try:
            await asyncio.gather(consumer_task)
        except asyncio.CancelledError:
            logger.debug("Tasks cancelled successfully.")

        cm.remove_queue(f"{str(entity_id)}_{connection_id}")
    logger.debug(f"WebSocket connection closed for entity {entity_id}")


@router.websocket("/events")
async def websocket_events_endpoint(websocket: WebSocket):
    if InfrakitchenConfig().websocket is False:
        await websocket.close(code=1008)
        return

    websocket_manager = WebSocketConnectionManager()
    connection_id = str(uuid4())
    await websocket_manager.connect(websocket)
    try:
        user = await asyncio.wait_for(websocket_authenticate(websocket), timeout=AUTH_TIMEOUT)
    except TimeoutError:
        await websocket_manager.disconnect(websocket, code=status.WS_1008_POLICY_VIOLATION)
        return
    except WebSocketDisconnect:
        logger.debug("WebSocket disconnected during authentication")
        return

    cm = ConnectionManager()
    user_queue = await cm.get_queue(f"{str(user.id)}_{connection_id}")

    consumer_task = asyncio.create_task(rabbitmq_events_consumer(str(user.id), connection_id))
    code = status.WS_1000_NORMAL_CLOSURE
    try:
        while True:
            message = await asyncio.wait_for(user_queue.get(), timeout=RABBITMQ_QUEUE_TIMEOUT)
            await websocket.send_text(message)

    except TimeoutError:
        code = 3008
    except WebSocketDisconnect:
        logger.debug(f"WebSocket disconnected for user {user.id}")
    except Exception as e:
        code = status.WS_1011_INTERNAL_ERROR
        logger.debug(f"An error occurred in the WebSocket loop: {e}")
    finally:
        logger.debug(f"Cleaning up resources for user {user.id}")
        consumer_task.cancel()
        await websocket_manager.disconnect(websocket, code=code)
        try:
            await asyncio.gather(consumer_task)
        except asyncio.CancelledError:
            logger.debug("Tasks cancelled successfully.")

        cm.remove_queue(f"{str(user.id)}_{connection_id}")
    logger.debug(f"WebSocket connection closed for user {user.id}")
