"""backfill scv index

Revision ID: c3a9e1f7b2d4
Revises: 6809d8d036b3
Create Date: 2026-10-14 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c3a9e1f7b2d4"
down_revision: str | None = "6809d8d036b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Give each template's versions a unique index: oldest = 0, newest = highest; keeps existing manual order first
    op.execute(
        """
        UPDATE source_code_versions AS scv
        SET index = ranked.new_index
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY index, created_at, id) - 1 AS new_index
            FROM source_code_versions
        ) AS ranked
        WHERE scv.id = ranked.id AND scv.index IS DISTINCT FROM ranked.new_index
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
