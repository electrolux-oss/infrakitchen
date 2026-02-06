import asyncio
import logging
import os
import sys
import time
import json
from contextlib import asynccontextmanager, nullcontext
from fastapi.exceptions import RequestValidationError
from infrakitchen_mcp import setup_mcp_server
from sqlalchemy.exc import IntegrityError
from starlette.responses import JSONResponse

from core.utils.json_encoder import JsonEncoder

sys.path.append(os.path.join(os.path.dirname(__file__), "."))

from application.logger import change_logger

from core.event_stream_manager import start_rabbitmq_consumer

from application.init_app import init_app
from fastapi import FastAPI, Request

from core.config import InfrakitchenConfig, setup_service_environment
from core.utils.websocket_manager import WebSocketConnectionManager
from application.views import main_router
from core.casbin.enforcer import CasbinEnforcer
from core.errors import (
    AccessDenied,
    ChildrenIsNotReady,
    CloudWrongCredentials,
    ConfigError,
    DependencyError,
    EntityExistsError,
    EntityWrongState,
    EntityNotFound,
)

change_logger()


# delete info log for health check
class HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find("/zstatus") == -1


logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())

logger = logging.getLogger(__name__)

logging.getLogger("aiormq").setLevel(logging.WARNING)
logging.getLogger("aio_pika").setLevel(logging.WARNING)
logging.getLogger("aio_pika.queue").setLevel(logging.ERROR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    mcp_context = nullcontext()
    if InfrakitchenConfig().mcp_enabled:
        mcp_http_app = setup_mcp_server(app, mount_path="/api/mcp")
        mcp_context = mcp_http_app.router.lifespan_context(mcp_http_app)

    websocket_manager = WebSocketConnectionManager()
    loop = asyncio.get_running_loop()
    loop.create_task(start_rabbitmq_consumer())

    await init_app()
    await CasbinEnforcer().init_enforcer()

    async with mcp_context:
        yield

    await websocket_manager.close_all_connections()


app = FastAPI(
    title="InfraKitchen API",
    summary="InfraKitchen API for managing infrastructure",
    lifespan=lifespan,
)

setup_service_environment()


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    # Add process time header to calculate the time taken to process the request
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    response.headers["Access-Control-Expose-Headers"] = "Content-Range"
    return response


app.include_router(main_router)


@app.get("/zstatus")
async def healthcheck():
    # k8s health check
    return "OK"


# error handling
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    if isinstance(exc._errors, list):
        exc_body = []
        for err in exc._errors:
            if isinstance(err, dict):
                exc_body.append(err)
            else:
                exc_body.append(json.loads(json.dumps(err, cls=JsonEncoder)))

    else:
        exc_body = json.loads(json.dumps(exc._errors, cls=JsonEncoder))

    if exc_body and isinstance(exc_body, list):
        for err in exc_body:
            # Hide the input value in the error message
            err.pop("input", None)
            # Hide the context to avoid leaking sensitive information
            err.pop("ctx", None)

    logger.error(f"RequestValidationError: {exc}")
    return JSONResponse(
        status_code=422,
        content={"message": exc_body},
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    logger.error(f"ValueError: {exc}")
    return JSONResponse(
        status_code=400,
        content={"message": f"{exc}"},
    )


@app.exception_handler(DependencyError)
async def dependency_error(request: Request, exc: DependencyError):
    logger.error(f"DependencyError: {exc}")
    response_content = {
        "message": exc.message,
        "error_code": exc.error_code,
        "metadata": json.loads(json.dumps(exc.metadata, cls=JsonEncoder)),
    }
    logger.error(f"DependencyError: {response_content}")
    return JSONResponse(
        status_code=400,
        content=response_content,
    )


@app.exception_handler(EntityWrongState)
async def entity_not_in_right_state_handler(request: Request, exc: EntityWrongState):
    logger.error(f"EntityWrongState: {exc}")
    return JSONResponse(
        status_code=400,
        content={"message": f"{exc}"},
    )


@app.exception_handler(TypeError)
async def type_error_handler(request: Request, exc: TypeError):
    logger.error(f"TypeError: {exc}")
    return JSONResponse(
        status_code=400,
        content={"message": f"{exc}"},
    )


@app.exception_handler(EntityExistsError)
async def exists_error_handler(request: Request, exc: EntityExistsError):
    logger.error(f"EntityExistsError: {exc}")
    return JSONResponse(
        status_code=409,
        content={"message": f"{exc}"},
    )


@app.exception_handler(ChildrenIsNotReady)
async def children_error_handler(request: Request, exc: ChildrenIsNotReady):
    logger.error(f"ChildrenIsNotReady: {exc}")
    return JSONResponse(
        status_code=400,
        content={"message": f"{exc}"},
    )


@app.exception_handler(NotImplementedError)
async def not_implemented_error_handler(request: Request, exc: NotImplementedError):
    logger.error(f"NotImplementedError: {exc}")
    return JSONResponse(
        status_code=400,
        content={"message": f"{exc}"},
    )


@app.exception_handler(EntityNotFound)
async def not_found_error_handler(request: Request, exc: EntityNotFound):
    logger.error(f"EntityNotFound: {exc}")
    return JSONResponse(
        status_code=404,
        content={"message": f"{exc}"},
    )


@app.exception_handler(CloudWrongCredentials)
async def wrong_credentials_error_handler(request: Request, exc: CloudWrongCredentials):
    response_content = {
        "message": exc.message,
        "error_code": exc.error_code,
        "metadata": json.loads(json.dumps(exc.metadata, cls=JsonEncoder)),
    }
    logger.error(f"CloudWrongCredentials: {response_content}")
    return JSONResponse(
        status_code=401,
        content=response_content,
    )


@app.exception_handler(AccessDenied)
async def access_denied_error_handler(request: Request, exc: AccessDenied):
    logger.error(f"AccessDenied: {exc}")
    return JSONResponse(
        status_code=403,
        content={"message": f"{exc}"},
    )


@app.exception_handler(AssertionError)
async def assertion_error_handler(request: Request, exc: AssertionError):
    logger.error(f"AssertionError: {exc}")
    return JSONResponse(
        status_code=400,
        content={"message": f"{exc}"},
    )


@app.exception_handler(ConfigError)
async def config_error_handler(request: Request, exc: ConfigError):
    logger.error(f"ConfigError: {exc}")
    return JSONResponse(
        status_code=500,
        content={"message": f"{exc}"},
    )


@app.exception_handler(IntegrityError)
async def exists_in_db_error_handler(request: Request, exc: IntegrityError):
    logger.error(f"IntegrityError: {exc.orig.__cause__ if exc.orig else exc}")
    return JSONResponse(
        status_code=409,
        content={"message": f"{exc.orig.__cause__ if exc.orig else exc}"},
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error"},
    )
