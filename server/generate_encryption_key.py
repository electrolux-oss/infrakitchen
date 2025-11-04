import os
import base64
from cryptography.fernet import Fernet


def generate_keys():
    """
    Generates a .env.local file with the necessary environment variables.
    """

    key = Fernet.generate_key().decode()
    encryption_key = base64.urlsafe_b64encode(key.encode()).decode()

    jwt_secret = base64.urlsafe_b64encode(os.urandom(32)).decode()

    env_content = f'ENCRYPTION_KEY = "{encryption_key}"\nJWT_KEY = "{jwt_secret}"\n'
    return env_content


if __name__ == "__main__":
    keys = generate_keys()
    print(f"Generated keys:\n{keys}")  # noqa: T201
