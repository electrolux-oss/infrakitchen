import base64
import os
from cryptography.fernet import Fernet, InvalidToken
from typing import Any, override
from pydantic import SecretStr

from ..errors import ConfigError


class EncryptedSecretStr(SecretStr):
    def __init__(self, secret_value: str):
        if "EncryptedSecretStr:" in secret_value:
            # If the secret is already encrypted, use it as is
            encrypted = secret_value
        else:
            encrypted = encrypt_secret(secret_value)
        super().__init__(secret_value=encrypted)

    def get_encrypted_value(self) -> str:
        """
        Returns the encrypted value of the secret.
        """
        return self._secret_value

    def get_decrypted_value(self) -> str:
        """
        Returns the encrypted value of the secret as bytes.
        """
        decrypted = decrypt_secret(self._secret_value)
        return decrypted

    @override
    def __repr__(self) -> str:
        return "EncryptedSecretStr('**********')"

    @override
    def __str__(self) -> str:
        return "**********"


def encrypt_secret(secret: str, encrypted_key: str | None = None) -> str:
    """
    Encrypts a secret using Fernet symmetric encryption.
    Args:
        secret (str): The secret to encrypt.
        encrypted_key (str | None): The encryption key in base64 format.
            If None, it will be fetched from environment variables.
    """

    base64_key: str | None = None
    if encrypted_key:
        base64_key = encrypted_key
    elif os.getenv("ENCRYPTION_KEY"):
        base64_key = os.getenv("ENCRYPTION_KEY")
    else:
        raise ConfigError("Encryption key is not set in environment variables.")

    assert base64_key is not None, "ENCRYPTION_KEY is not set"
    try:
        decoded_key = base64.b64decode(base64_key)
        fernet = Fernet(decoded_key)

        encMessage = fernet.encrypt(secret.encode())
    except Exception as e:
        raise ConfigError("Invalid ENCRYPTION_KEY") from e

    return f"EncryptedSecretStr:{encMessage.decode()}"


def decrypt_secret(encrypted_secret: str, encrypted_key: str | None = None) -> str:
    """
    Decrypts a secret using Fernet symmetric encryption.
    Args:
        encrypted_secret (str): The encrypted secret to decrypt.
        encrypted_key (str | None): The encryption key in base64 format.
            If None, it will be fetched from environment variables.
    """

    base64_key: str | None = None
    if encrypted_key:
        base64_key = encrypted_key
    elif os.getenv("ENCRYPTION_KEY"):
        base64_key = os.getenv("ENCRYPTION_KEY")
    else:
        raise ConfigError("Encryption key is not set in environment variables.")

    assert base64_key is not None, "ENCRYPTION_KEY is not set"
    decoded_key = base64.b64decode(base64_key)
    fernet = Fernet(decoded_key)

    if "EncryptedSecretStr:" in encrypted_secret:
        encrypted_secret = encrypted_secret.split("EncryptedSecretStr:")[1]
    else:
        raise ValueError("Invalid encrypted secret format")

    try:
        decMessage = fernet.decrypt(encrypted_secret.encode()).decode()
    except InvalidToken as e:
        raise ConfigError("Decryption failed. Check if encryption key is valid") from e

    return decMessage


def mask_secret_values(data: dict[str, Any] | list[Any]) -> None:
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, EncryptedSecretStr):
                data[key] = "********"
            elif isinstance(value, dict):
                mask_secret_values(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        mask_secret_values(item)
    elif isinstance(data, list):
        for item in data:
            mask_secret_values(item)
