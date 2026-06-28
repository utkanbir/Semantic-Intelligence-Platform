"""Add discovery_sessions and discovery_phase_history tables.

Revision ID: 20260628_0005
Revises: 20260628_0004
Create Date: 2026-06-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260628_0005"
down_revision: Union[str, None] = "20260628_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discovery_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("started_by", sa.String(length=255), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("intent_summary", sa.Text(), nullable=True),
        sa.Column("discovery_notes", sa.Text(), nullable=True),
        sa.Column("recommendations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("generated_blueprint_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("conversation_history", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["applications.id"],
            name=op.f("fk_discovery_sessions_application_id_applications"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_discovery_sessions")),
    )
    op.create_index(
        op.f("ix_discovery_sessions_application_id"),
        "discovery_sessions",
        ["application_id"],
        unique=False,
    )

    op.create_table(
        "discovery_phase_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phase_number", sa.Integer(), nullable=False),
        sa.Column("phase_name", sa.String(length=255), nullable=False),
        sa.Column("entered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["discovery_sessions.id"],
            name=op.f("fk_discovery_phase_history_session_id_discovery_sessions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_discovery_phase_history")),
    )
    op.create_index(
        op.f("ix_discovery_phase_history_session_id"),
        "discovery_phase_history",
        ["session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_discovery_phase_history_session_id"), table_name="discovery_phase_history")
    op.drop_table("discovery_phase_history")
    op.drop_index(op.f("ix_discovery_sessions_application_id"), table_name="discovery_sessions")
    op.drop_table("discovery_sessions")
