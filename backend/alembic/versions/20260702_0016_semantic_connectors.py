"""Add semantic_connectors, ontology connector fields, application_id on transactions.

Revision ID: 20260702_0016
Revises: 20260629_0015
Create Date: 2026-07-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260702_0016"
down_revision: Union[str, None] = "20260629_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
    op.add_column(
        "semantic_transactions",
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_semantic_transactions_application_id",
        "semantic_transactions",
        "applications",
        ["application_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "ontology_definitions",
        sa.Column("semantic_connector_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "ontology_definitions",
        sa.Column("artifact_uri", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "ontology_definitions",
        sa.Column("source_format", sa.String(length=50), nullable=True),
    )
    op.create_foreign_key(
        "fk_ontology_definitions_semantic_connector_id",
        "ontology_definitions",
        "semantic_connectors",
        ["semantic_connector_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_ontology_definitions_semantic_connector_id",
        "ontology_definitions",
        type_="foreignkey",
    )
    op.drop_column("ontology_definitions", "source_format")
    op.drop_column("ontology_definitions", "artifact_uri")
    op.drop_column("ontology_definitions", "semantic_connector_id")
    op.drop_constraint(
        "fk_semantic_transactions_application_id",
        "semantic_transactions",
        type_="foreignkey",
    )
    op.drop_column("semantic_transactions", "application_id")
    op.drop_table("semantic_connectors")
