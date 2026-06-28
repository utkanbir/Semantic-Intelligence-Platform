"""Add trace_steps table.

Revision ID: 20260628_0008
Revises: 20260628_0007
Create Date: 2026-06-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260628_0008"
down_revision: Union[str, None] = "20260628_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trace_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("semantic_transaction_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("step_type", sa.String(length=100), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["semantic_transaction_id"],
            ["semantic_transactions.id"],
            name=op.f("fk_trace_steps_semantic_transaction_id_semantic_transactions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trace_steps")),
    )
    op.create_index(
        op.f("ix_trace_steps_semantic_transaction_id"),
        "trace_steps",
        ["semantic_transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_trace_steps_semantic_transaction_id"), table_name="trace_steps")
    op.drop_table("trace_steps")
