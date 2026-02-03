"""add validation rules tables

Revision ID: 7e5c1d7f9f1c
Revises: 55a4914f255c
Create Date: 2026-02-03 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7e5c1d7f9f1c"
down_revision: str | None = "f6486f2ec823"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "validation_rules",
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.Column("variable_name", sa.String(), nullable=False),
        sa.Column(
            "target_type",
            sa.Enum("string", "number", name="validation_rule_target_type", native_enum=False),
            nullable=False,
        ),
        sa.Column("min_value", sa.Numeric(precision=20, scale=5), nullable=True),
        sa.Column("max_value", sa.Numeric(precision=20, scale=5), nullable=True),
        sa.Column("regex_pattern", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.CheckConstraint(
            "(min_value IS NULL) OR (max_value IS NULL) OR (min_value <= max_value)",
            name="ck_validation_rules_min_le_max",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_validation_rules_template_variable",
        "validation_rules",
        ["template_id", "variable_name"],
        unique=True,
    )

    op.create_table(
        "validation_rule_template_references",
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.Column("reference_template_id", sa.UUID(), nullable=False),
        sa.Column("variable_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.CheckConstraint(
            "template_id <> reference_template_id",
            name="ck_validation_ref_template_not_self",
        ),
        sa.ForeignKeyConstraint(["reference_template_id"], ["templates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_validation_rule_template_reference_var",
        "validation_rule_template_references",
        ["template_id", "variable_name"],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "ix_validation_rule_template_reference_var",
        table_name="validation_rule_template_references",
    )
    op.drop_table("validation_rule_template_references")

    op.drop_index("ix_validation_rules_template_variable", table_name="validation_rules")
    op.drop_table("validation_rules")
