"""Initial Alembic baseline (no domain tables).

Revision ID: 20260626_0001
Revises:
Create Date: 2026-06-26

S0-06: establishes migration history; domain schemas added in later sprints.
"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "20260626_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
