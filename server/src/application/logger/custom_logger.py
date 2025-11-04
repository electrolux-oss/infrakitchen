import logging
import os
from typing import Any


def change_logger():
    """
    Configure the root logger with timestamps and environment-specific formatting.

    This function sets up the logging configuration for the entire application:
    - Development: Human-readable format with timestamps
    - Production: JSON format with timestamps

    The configuration is applied to the root logger, which affects all loggers
    that don't have their own handlers configured.

    Environment Variables:
        LOG_LEVEL: Logging level (DEBUG, INFO, WARNING, ERROR).
        ENV: Set to "production" for JSON log format.

    Example output:
        Development: "2025-10-06 13:07:09 - [app] - INFO - Application started"
        Production: {"time": "2025-10-06 13:07:09", "name": "[app]", "level": "INFO", "message": "Application started"}
    """
    # Determine log level from environment
    log_level = os.getenv("LOG_LEVEL", "INFO")

    # Use JSON format in production, human-readable format with timestamps in development
    if os.getenv("ENV") == "production":
        log_format = (
            """{"time": "%(asctime)s", "name": "[%(name)s]", "level": "%(levelname)s", "message": "%(message)s"}"""
        )
    else:
        log_format = "%(asctime)s - [%(name)s] - %(levelname)s - %(message)s"

    # Configure root logger for application code
    logging.basicConfig(
        level=log_level,
        format=log_format,
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True,  # Force reconfiguration even if logging is already configured
    )


def get_uvicorn_log_config() -> dict[str, Any]:
    """
    Generate uvicorn logging configuration dictionary with timestamps.

    This function creates a logging configuration for uvicorn that matches
    the format used by change_logger(). It must be passed to uvicorn's
    Config(log_config=...) parameter to ensure uvicorn logs (access logs,
    server startup/shutdown) include timestamps.

    Returns:
        dict: Logging configuration dictionary compatible with Python's
              logging.config.dictConfig() and uvicorn's log_config parameter.

    Environment Variables:
        LOG_LEVEL: Logging level for uvicorn loggers.
        ENV: Set to "production" for JSON log format.

    Usage:
        >>> server = uvicorn.Server(
        ...     config=uvicorn.Config(
        ...         app=app,
        ...         host="0.0.0.0",
        ...         log_config=get_uvicorn_log_config(),
        ...     )
        ... )

    Note:
        The configuration sets propagate=False for uvicorn loggers to prevent
        duplicate log entries when both root and uvicorn handlers are active.
    """
    log_level = os.getenv("LOG_LEVEL", "INFO")

    # Use same format as change_logger() for consistency
    if os.getenv("ENV") == "production":
        log_format = (
            """{"time": "%(asctime)s", "name": "[%(name)s]", "level": "%(levelname)s", "message": "%(message)s"}"""
        )
    else:
        log_format = "%(asctime)s - [%(name)s] - %(levelname)s - %(message)s"

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": log_format,
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stderr",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": log_level, "propagate": False},
            "uvicorn.error": {"handlers": ["default"], "level": log_level, "propagate": False},
            "uvicorn.access": {"handlers": ["default"], "level": log_level, "propagate": False},
        },
    }
