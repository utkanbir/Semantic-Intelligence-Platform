"""Drop deprecated semantic_connectors table (unified Connector model).

Revision ID: 20260704_0018
Revises: 20260703_0017
Create Date: 2026-07-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260704_0018"
down_revision: Union[str, None] = "20260703_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("semantic_connectors")


def downgrade() -> None:
    op.create_table(
        "semantic_connectors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("connector_key", sa.String(length=255), nullable=False),
        sa.Column("connector_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("technology_adapter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("connector_configuration", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(
            ["technology_adapter_id"],
            ["technology_adapters.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connector_key", name="uq_semantic_connectors_connector_key"),
    )
