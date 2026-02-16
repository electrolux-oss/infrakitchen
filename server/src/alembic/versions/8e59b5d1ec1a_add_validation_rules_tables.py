"""add validation rules tables

Revision ID: 8e59b5d1ec1a
Revises: f6486f2ec823
Create Date: 2026-02-03 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8e59b5d1ec1a"
down_revision: str | None = "ccab3f034756"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "validation_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "target_type",
            sa.Enum("string", "number", name="validation_rule_target_type", native_enum=False),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("min_value", sa.Numeric(precision=20, scale=5), nullable=True),
        sa.Column("max_value", sa.Numeric(precision=20, scale=5), nullable=True),
        sa.Column("regex_pattern", sa.Text(), nullable=True),
        sa.Column("max_length", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.CheckConstraint(
            "(min_value IS NULL) OR (max_value IS NULL) OR (min_value <= max_value)",
            name="ck_validation_rules_min_le_max",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_validation_rules_signature",
        "validation_rules",
        [
            "target_type",
            "description",
            "min_value",
            "max_value",
            "regex_pattern",
            "max_length",
        ],
    )

    op.create_table(
        "validation_rule_template_references",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.Column("variable_name", sa.String(), nullable=False),
        sa.Column("validation_rule_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["validation_rule_id"], ["validation_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_validation_rule_template_reference_var",
        "validation_rule_template_references",
        ["template_id", "variable_name", "validation_rule_id"],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_validation_rules_signature", table_name="validation_rules")
    op.drop_index(
        "ix_validation_rule_template_reference_var",
        table_name="validation_rule_template_references",
    )
    op.drop_table("validation_rule_template_references")

    op.drop_table("validation_rules")
