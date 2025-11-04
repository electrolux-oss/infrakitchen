import os
from typing import Any
from dotenv import load_dotenv
from pydantic import computed_field
from pydantic_settings import BaseSettings
from sqlalchemy import URL

from core.singleton_meta import SingletonMeta


def setup_service_environment():
    """
    Sets up the environment by loading environment variables from .env files.
    """
    if not os.path.exists(".env"):
        raise FileNotFoundError("The .env file is missing. Please create it with the required settings.")

    _ = load_dotenv(".env")
    if os.path.exists(".env_local"):
        _ = load_dotenv(".env_local", override=True)


class Settings(BaseSettings):
    # Database settings
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_USER: str = "dev_user"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "infrakitchen"
    BROKER_URL: str = "amqp://guest:guest@localhost/"
    LOG_LEVEL: str = "INFO"
    DATABASE_DRIVER: str = "asyncpg"
    CACHE_DISABLED: str = "false"
    JWT_KEY: str = "supersecret"
    SESSION_EXPIRATION: str = "3600"

    class ConfigDict:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @computed_field
    def db_url(self) -> str | URL:
        return (
            f"postgresql+{self.DATABASE_DRIVER}://"
            f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


class InfrakitchenConfig(metaclass=SingletonMeta):
    approval_flow: bool = True
    demo_mode: bool = False

    def __setattr__(self, name: str, value: Any, /) -> None:
        if not hasattr(self, name):
            raise AttributeError(f"Cannot add new attribute '{name}' to Configuration")
        super().__setattr__(name, value)

    def __rep__(self) -> str:
        return f"InfrakitchenConfig(approval_flow={self.approval_flow}, demo_mode={self.demo_mode})"

    def __str__(self) -> str:
        return self.__rep__()
