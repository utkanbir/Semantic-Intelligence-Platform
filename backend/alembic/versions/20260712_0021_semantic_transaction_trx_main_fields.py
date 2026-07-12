"""Add trx_main fields to semantic_transactions per ADR-002 (S39-01).

Revision ID: 20260712_0021
Revises: 20260709_0020
Create Date: 2026-07-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260712_0021"
down_revision: Union[str, None] = "20260709_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "semantic_transactions",
        sa.Column("question_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "semantic_transactions",
        sa.Column("answer_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "semantic_transactions",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "semantic_transactions",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "semantic_transactions",
        sa.Column("total_duration_ms", sa.Integer(), nullable=True),
    )
    op.add_column(
        "semantic_transactions",
        sa.Column("mode", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("semantic_transactions", "mode")
    op.drop_column("semantic_transactions", "total_duration_ms")
    op.drop_column("semantic_transactions", "completed_at")
    op.drop_column("semantic_transactions", "started_at")
    op.drop_column("semantic_transactions", "answer_text")
    op.drop_column("semantic_transactions", "question_text")
