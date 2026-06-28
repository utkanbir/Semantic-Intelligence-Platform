"""Add applications and application_workspaces tables.

Revision ID: 20260628_0002
Revises: 20260626_0001
Create Date: 2026-06-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260628_0002"
down_revision: Union[str, None] = "20260626_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_applications")),
        sa.UniqueConstraint("key", name=op.f("uq_applications_key")),
    )

    op.create_table(
        "application_workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("postgres_schema", sa.String(length=255), nullable=False),
        sa.Column("minio_namespace", sa.String(length=255), nullable=False),
        sa.Column("fuseki_dataset", sa.String(length=255), nullable=False),
        sa.Column("qdrant_collection", sa.String(length=255), nullable=False),
        sa.Column("metadata_domain", sa.String(length=255), nullable=False),
        sa.Column("ontology_namespace", sa.String(length=255), nullable=False),
        sa.Column("agent_namespace", sa.String(length=255), nullable=False),
        sa.Column("product_registry_namespace", sa.String(length=255), nullable=False),
        sa.Column("agent_registry_namespace", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["applications.id"],
            name=op.f("fk_application_workspaces_application_id_applications"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_application_workspaces")),
        sa.UniqueConstraint("application_id", name=op.f("uq_application_workspaces_application_id")),
    )


def downgrade() -> None:
    op.drop_table("application_workspaces")
    op.drop_table("applications")
