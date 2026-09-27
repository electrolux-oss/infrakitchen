import json

from sqlalchemy.ext.asyncio import create_async_engine

from core.config import setup_service_environment
from core.utils.json_encoder import JsonEncoder

setup_service_environment()

from core.config import Settings  # noqa: E402

# Kept apart from core.database so that modules imported by core.database
# (e.g. EventSender) can use the engine without an import cycle.
engine = create_async_engine(
    str(Settings().db_url),
    pool_size=20,
    max_overflow=40,
    json_serializer=lambda obj: json.dumps(obj, cls=JsonEncoder),
)
