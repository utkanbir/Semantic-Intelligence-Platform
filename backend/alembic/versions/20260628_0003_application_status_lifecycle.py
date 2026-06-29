"""Add status column to applications table.

Revision ID: 20260628_0003
Revises: 20260628_0002
Create Date: 2026-06-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260628_0003"
down_revision: Union[str, None] = "20260628_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="provisioned",
        ),
    )
    op.alter_column("applications", "status", server_default=None)


def downgrade() -> None:
    op.drop_column("applications", "status")
