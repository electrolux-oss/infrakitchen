from contextlib import asynccontextmanager
import functools
import inspect
import logging
from collections.abc import Callable
import pickle
from typing import Any
from collections.abc import Awaitable

from core.caches.crud import CacheCRUD
from core.caches.schema import CacheCreate
from core.caches.service import CacheService
from core.database import SessionLocal
from core.config import Settings


logger = logging.getLogger(__name__)


@asynccontextmanager
async def get_async_session():
    async with SessionLocal() as session:
        yield session


def cache_decorator(avoid_args: bool = False, ttl: int = 60):
    """
    Cache decorator for async functions
    :param ttl: time to live in seconds, default 60 seconds
    :return: decorator
    """

    def decorator(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> dict[str, Any] | str:
            if Settings().CACHE_DISABLED == "true":
                return await func(*args, **kwargs)

            # Generate a consistent cache key
            try:
                key_args = ""
                if args and avoid_args is False:
                    sig = inspect.signature(func)
                    params = list(sig.parameters.values())
                    if params and params[0].name == "self":
                        key_args = repr(args[1:])  # Exclude the self from args
                    else:
                        key_args = repr(args)

                key_kwargs = repr(kwargs)
            except Exception as e:
                logger.warning(f"Could not repr args/kwargs for cache key: {e}. Skipping cache for this call.")
                return await func(*args, **kwargs)

            result = {}

            async with get_async_session() as session:
                cache_service = CacheService(
                    crud=CacheCRUD(session=session),
                )

                module = func.__module__
                key = f"{func.__qualname__}:{key_args}:{key_kwargs}"
                # Check if the result is already cached
                cached_item = await cache_service.get_cache(module=module, key=key)

                if cached_item:
                    try:
                        # Deserialize the binary data back to the original Python object
                        deserialized_value = pickle.loads(cached_item.value)
                        logger.debug(f"Cache hit for {key} in module {module}. Returning cached result.")
                        return deserialized_value
                    except pickle.UnpicklingError as e:
                        logger.error(f"Error unpickling cached data for key {key}: {e}. Fetching fresh data.")
                        # If unpickling fails, treat as a cache miss
                else:
                    logger.debug(f"Cache miss for {key} in module {module}. Fetching fresh data.")

                # Call the actual function
                result = await func(*args, **kwargs)

                try:
                    # Serialize the result to binary using pickle.dumps()
                    # This handles Pydantic models, lists of models, dicts, etc.
                    pickled_result = pickle.dumps(result)
                    _ = await cache_service.set_cache(
                        CacheCreate(module=module, key=key, value=pickled_result), ttl=ttl
                    )
                    logger.debug(f"Successfully cached result for {key} in module {module}.")
                except Exception as e:
                    # Do not raise exception if cache is not saved, just log it
                    logger.error(f"Error saving cache for {key} in module {module}: {e}")
            return result

        return wrapper

    return decorator
