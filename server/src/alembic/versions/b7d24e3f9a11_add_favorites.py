"""add favorites

Revision ID: b7d24e3f9a11
Revises: 8e59b5d1ec1a
Create Date: 2026-02-19 14:45:01.975048

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7d24e3f9a11"
down_revision: str | None = "8e59b5d1ec1a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "favorites",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("component_type", sa.String(), nullable=False),
        sa.Column("component_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("user_id", "component_type", "component_id"),
    )
    op.create_index(op.f("ix_favorites_user_id"), "favorites", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_favorites_user_id"), table_name="favorites")
    op.drop_table("favorites")
