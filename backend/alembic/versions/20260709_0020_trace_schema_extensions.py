"""Extend trace_steps and semantic_transactions for typed multi-layer tracing (S38-01).

Revision ID: 20260709_0020
Revises: 20260706_0019
Create Date: 2026-07-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260709_0020"
down_revision: Union[str, None] = "20260706_0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "semantic_transactions",
        sa.Column("status", sa.String(length=50), server_default="Completed", nullable=False),
    )
    op.add_column(
        "semantic_transactions",
        sa.Column("initiated_by", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "semantic_transactions",
        sa.Column(
            "participating_assets",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    op.add_column("trace_steps", sa.Column("layer", sa.String(length=50), nullable=True))
    op.add_column("trace_steps", sa.Column("status", sa.String(length=50), nullable=True))
    op.add_column("trace_steps", sa.Column("input_summary", sa.Text(), nullable=True))
    op.add_column("trace_steps", sa.Column("output_summary", sa.Text(), nullable=True))
    op.add_column("trace_steps", sa.Column("duration_ms", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("trace_steps", "duration_ms")
    op.drop_column("trace_steps", "output_summary")
    op.drop_column("trace_steps", "input_summary")
    op.drop_column("trace_steps", "status")
    op.drop_column("trace_steps", "layer")
    op.drop_column("semantic_transactions", "participating_assets")
    op.drop_column("semantic_transactions", "initiated_by")
    op.drop_column("semantic_transactions", "status")
