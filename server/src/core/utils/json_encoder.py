import datetime
import functools
import json
from uuid import UUID

from pydantic import HttpUrl

from ..models.encrypted_secret import EncryptedSecretStr


class JsonEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime.datetime):
            return f"{o.isoformat()}"
        elif isinstance(o, functools.partial):
            return
        elif isinstance(o, EncryptedSecretStr):
            return "********"
        elif isinstance(o, UUID):
            return str(o)
        elif isinstance(o, HttpUrl):
            return str(o)
        else:
            return json.JSONEncoder.default(self, o)
