import pytest
import base64
from cryptography.fernet import Fernet
from core.errors import ConfigError
from core.models.encrypted_secret import encrypt_secret, decrypt_secret


def test_encrypt_secret():
    key = Fernet.generate_key()

    encoded_key = base64.encodebytes(key).decode()
    secret = "my_secret"
    encrypted_secret = encrypt_secret(secret, encoded_key)
    assert encrypted_secret != secret
    assert len(encrypted_secret) > len(secret)


def test_decrypt_secret():
    key = Fernet.generate_key()

    encoded_key = base64.encodebytes(key).decode()
    secret = "my_secret"
    encrypted_secret = encrypt_secret(secret, encoded_key)
    decrypted_secret = decrypt_secret(encrypted_secret, encoded_key)
    assert decrypted_secret == secret


def test_decrypt_secret_negative():
    key = Fernet.generate_key()

    encoded_key = base64.encodebytes(key).decode()
    secret = "my_secret"
    encrypted_secret = encrypt_secret(secret, encoded_key)
    key = Fernet.generate_key()
    wrong_encoded_key = base64.encodebytes(key).decode()
    assert wrong_encoded_key != encoded_key
    with pytest.raises(ConfigError):
        _ = decrypt_secret(
            encrypted_secret,
            wrong_encoded_key,
        )
