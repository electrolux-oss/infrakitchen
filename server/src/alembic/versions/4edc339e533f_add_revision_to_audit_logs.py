"""add revision to audit logs

Revision ID: 4edc339e533f
Revises: a94fd5a63385
Create Date: 2026-04-09 13:51:41.208317

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "4edc339e533f"
down_revision: str | None = "a94fd5a63385"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("audit_logs", sa.Column("revision_number", sa.Integer(), nullable=True))
    op.execute(
        text("""
        UPDATE audit_logs al
        SET revision_number = r.revision_number
        FROM (
            SELECT DISTINCT ON (r.entity_id, al.id)
                al.id AS audit_log_id,
                r.revision_number
            FROM audit_logs al
            JOIN revisions r ON r.entity_id = al.entity_id
            WHERE al.revision_number IS NULL
              AND r.created_at <= al.created_at
            ORDER BY r.entity_id, al.id, r.created_at DESC
        ) r
        WHERE al.id = r.audit_log_id
    """)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("audit_logs", "revision_number")
