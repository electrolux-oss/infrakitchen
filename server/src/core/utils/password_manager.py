import asyncio
import base64
import hashlib
import hmac
import os


def hash_new_password(password: str) -> tuple[str, str]:
    """
    Hash the provided password with a randomly-generated salt and return the
    salt and hash to store in the database.
    """
    salt = os.urandom(16)
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)

    return base64.b64encode(salt).decode(), base64.b64encode(pw_hash).decode()


def is_correct_password(salt: str, pw_hash: str, password: str) -> bool:
    """
    Given a previously-stored salt and hash, and a password provided by a user
    trying to log in, check whether the password is correct.
    """
    return hmac.compare_digest(
        base64.b64decode(pw_hash), hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), 100000)
    )


async def is_correct_password_async(salt: str, pw_hash: str, password: str) -> bool:
    """is_correct_password off the event loop: PBKDF2 would otherwise stall every other request."""
    return await asyncio.to_thread(is_correct_password, salt, pw_hash, password)


# Verified when the user is unknown, so both outcomes take the same time
_DUMMY_SALT, _DUMMY_HASH = hash_new_password(base64.b64encode(os.urandom(16)).decode())


async def burn_password_check(password: str) -> None:
    _ = await is_correct_password_async(_DUMMY_SALT, _DUMMY_HASH, password)
