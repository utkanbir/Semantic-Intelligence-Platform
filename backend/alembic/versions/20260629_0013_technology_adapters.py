"""Add technology_adapters table.

Revision ID: 20260629_0013
Revises: 20260629_0012
Create Date: 2026-06-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260629_0013"
down_revision: Union[str, None] = "20260629_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "technology_adapters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technology_type", sa.String(length=50), nullable=False),
        sa.Column("adapter_key", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("configured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deprecated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "adapter_configuration",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_technology_adapters")),
        sa.UniqueConstraint("adapter_key", name=op.f("uq_technology_adapters_adapter_key")),
    )


def downgrade() -> None:
    op.drop_table("technology_adapters")
