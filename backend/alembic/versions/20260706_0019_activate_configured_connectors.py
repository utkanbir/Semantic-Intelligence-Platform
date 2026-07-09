"""Activate legacy Configured technology adapters.

Revision ID: 20260706_0019
Revises: 20260704_0018
Create Date: 2026-07-06
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260706_0019"
down_revision: Union[str, None] = "20260704_0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE technology_adapters
        SET status = 'Active',
            configured_at = COALESCE(configured_at, NOW()),
            activated_at = COALESCE(activated_at, NOW()),
            updated_at = NOW()
        WHERE status = 'Configured'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE technology_adapters
        SET status = 'Configured',
            activated_at = NULL,
            updated_at = NOW()
        WHERE status = 'Active'
          AND configured_at IS NOT NULL
          AND activated_at IS NOT NULL
        """
    )
