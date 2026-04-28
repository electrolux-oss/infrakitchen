"""add template advanced documentation

Revision ID: 35c9875e3ce3
Revises: 6f73b5194d89
Create Date: 2026-04-22 21:12:05.586899

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "35c9875e3ce3"
down_revision: str | None = "6f73b5194d89"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("templates", sa.Column("documentation", sa.Text(), nullable=True, server_default=""))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("templates", "documentation")
