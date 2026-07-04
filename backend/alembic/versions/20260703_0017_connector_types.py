"""Rename technology types to platform connector types; ontology FK to connectors.

Revision ID: 20260703_0017
Revises: 20260702_0016
Create Date: 2026-07-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260703_0017"
down_revision: Union[str, None] = "20260702_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONNECTOR_TYPE_MAP: dict[str, str] = {
    "postgresql": "database",
    "minio": "object_storage",
    "fuseki": "ontology_knowledge_graph",
    "qdrant": "object_storage",
    "openmetadata": "object_storage",
    "openai": "object_storage",
}


def upgrade() -> None:
    for old_value, new_value in CONNECTOR_TYPE_MAP.items():
        op.execute(
            sa.text(
                "UPDATE technology_adapters SET technology_type = :new "
                "WHERE technology_type = :old"
            ).bindparams(new=new_value, old=old_value)
        )

    op.alter_column(
        "technology_adapters",
        "technology_type",
        new_column_name="connector_type",
        existing_type=sa.String(length=50),
        existing_nullable=False,
    )

    op.drop_constraint(
        "fk_ontology_definitions_semantic_connector_id",
        "ontology_definitions",
        type_="foreignkey",
    )
    op.alter_column(
        "ontology_definitions",
        "semantic_connector_id",
        new_column_name="connector_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        existing_nullable=True,
    )
    op.create_foreign_key(
        "fk_ontology_definitions_connector_id",
        "ontology_definitions",
        "technology_adapters",
        ["connector_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_ontology_definitions_connector_id",
        "ontology_definitions",
        type_="foreignkey",
    )
    op.alter_column(
        "ontology_definitions",
        "connector_id",
        new_column_name="semantic_connector_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        existing_nullable=True,
    )
    op.create_foreign_key(
        "fk_ontology_definitions_semantic_connector_id",
        "ontology_definitions",
        "semantic_connectors",
        ["semantic_connector_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.alter_column(
        "technology_adapters",
        "connector_type",
        new_column_name="technology_type",
        existing_type=sa.String(length=50),
        existing_nullable=False,
    )

    reverse_map = {
        "database": "postgresql",
        "object_storage": "minio",
        "ontology_knowledge_graph": "fuseki",
        "file_system": "minio",
    }
    for new_value, old_value in reverse_map.items():
        op.execute(
            sa.text(
                "UPDATE technology_adapters SET technology_type = :old "
                "WHERE technology_type = :new"
            ).bindparams(new=new_value, old=old_value)
        )
