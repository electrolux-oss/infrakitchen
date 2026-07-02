import uuid
from datetime import datetime

import strawberry


@strawberry.type
class SchedulerJobType:
    id: uuid.UUID
    type: str
    script: str
    cron: str
    created_at: datetime
