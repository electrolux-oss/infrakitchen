import os

# generate encryption key
import base64
from cryptography.fernet import Fernet

key = Fernet.generate_key().decode()
wrapped_key = base64.urlsafe_b64encode(key.encode()).decode()

os.environ.setdefault("BROKER_URL", "amqp://guest:guest@localhost:5672/")
os.environ.setdefault("LOG_LEVEL", "DEBUG")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "postgres")
os.environ.setdefault("POSTGRES_PASSWORD", "postgres")
os.environ.setdefault("POSTGRES_DB", "testdb")
os.environ.setdefault("DATABASE_DRIVER", "asyncpg")
os.environ.setdefault("CACHE_DISABLED", "false")
os.environ.setdefault("JWT_KEY", "supersecret")
os.environ.setdefault("SESSION_EXPIRATION", "3600")
os.environ.setdefault("ENCRYPTION_KEY", wrapped_key)
