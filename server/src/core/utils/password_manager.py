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
