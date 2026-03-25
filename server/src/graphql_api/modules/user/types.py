import uuid
from datetime import datetime

import strawberry


@strawberry.type
class UserType:
    id: uuid.UUID
    email: str | None = None
    identifier: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    display_name: str | None = None
    provider: str | None = None
    deactivated: bool = False
    description: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None
