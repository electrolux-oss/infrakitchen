"""add validation rules table

Revision ID: 937b6a3f2c28
Revises: 55a4914f255c
Create Date: 2026-01-27 11:45:00.000000

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "937b6a3f2c28"
down_revision: str | None = "55a4914f255c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "validation_rules",
        sa.Column("entity_name", sa.String(length=128), nullable=False),
        sa.Column("field_path", sa.String(length=256), nullable=False),
        sa.Column(
            "data_type",
            sa.Enum("string", "number", name="validation_rule_data_type", native_enum=False),
            nullable=False,
        ),
        sa.Column("regex", sa.String(length=512), nullable=True),
        sa.Column("no_whitespace", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("max_length", sa.Integer(), nullable=True),
        sa.Column("min_value", sa.Numeric(precision=20, scale=6), nullable=True),
        sa.Column("max_value", sa.Numeric(precision=20, scale=6), nullable=True),
        sa.Column("rule_metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_name", "field_path", name="uq_validation_rules_entity_field"),
    )
    op.create_index("ix_validation_rules_entity", "validation_rules", ["entity_name"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_validation_rules_entity", table_name="validation_rules")
    op.drop_table("validation_rules")
