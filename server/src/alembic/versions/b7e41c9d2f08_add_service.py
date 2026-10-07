"""add service

Revision ID: b7e41c9d2f08
Revises: ee182a56460b
Create Date: 2026-09-08 10:12:44.108221

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7e41c9d2f08"
down_revision: str | None = "ee182a56460b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "services",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("repository_url", sa.String(), nullable=True),
        sa.Column("labels", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_service_project_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_services_name"), "services", ["name"], unique=False)
    op.create_index("ix_service_project_id_name", "services", ["project_id", "name"], unique=True)

    op.create_table(
        "service_owners",
        sa.Column("service_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("service_id", "user_id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("service_owners")
    op.drop_index("ix_service_project_id_name", table_name="services")
    op.drop_index(op.f("ix_services_name"), table_name="services")
    op.drop_table("services")
