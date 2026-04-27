import datetime
import random
from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from core.audit_logs.handler import AuditLogHandler
from core.custom_entity_log_controller import EntityLogger


async def generate_logs(session: AsyncSession, entity_name: str, entity_id: str, user_id: str):
    async def insert_logs(log_controller: EntityLogger):
        for _ in range(100):
            lvl = random.choice(levels)
            if lvl == "info":
                log_controller.info(get_sentence())
            elif lvl == "error":
                log_controller.error(get_sentence())
            elif lvl == "warning":
                log_controller.warning(get_sentence())
        await log_controller.save_log()

    levels = ["info", "error", "warning"]

    audit_log_handler = AuditLogHandler(session=session, entity_name=entity_name)
    await audit_log_handler.create_log(
        entity_id=entity_id,
        requester_id=user_id,
        action="execute",
    )
    await session.commit()

    log_controller = EntityLogger(
        entity_name=entity_name,
        entity_id=entity_id,
        trace_id=audit_log_handler.trace_id,
        audit_log_id=audit_log_handler.audit_log_id,
    )
    for i in range(1, 4):
        log_controller.execution_start = int(datetime.datetime.now().timestamp()) - i * 3000
        log_controller.add_log_header(f"User: {user_id} Action: Unknown")
        await insert_logs(log_controller)
