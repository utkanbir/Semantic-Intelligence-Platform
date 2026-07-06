"""Resolve connector port implementations from type and configuration."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.infrastructure.adapters.fuseki import FusekiKnowledgeGraphAdapter
from app.modules.adapters.domain.enums import ConnectorType
from app.modules.adapters.services.adapter_stubs import AdapterFactory
from app.modules.adapters.services.connector_provision import read_vendor
from app.shared.ports.knowledge_graph import KnowledgeGraphPort
from app.shared.ports.object_storage import ObjectStoragePort
from app.shared.ports.relational_db import RelationalDBPort
from app.shared.ports.vector_store import VectorStorePort


class UnsupportedConnectorPortError(Exception):
    """Raised when no port adapter exists for the connector type and vendor."""


def resolve_connector_port(
    connector_type: ConnectorType | str,
    configuration: dict[str, Any],
    *,
    session: Session,
) -> RelationalDBPort | ObjectStoragePort | KnowledgeGraphPort | VectorStorePort:
    type_value = (
        connector_type.value if isinstance(connector_type, ConnectorType) else connector_type
    )

    if type_value == ConnectorType.ONTOLOGY_KNOWLEDGE_GRAPH.value:
        vendor = read_vendor(configuration)
        if vendor == "apache_fuseki":
            return FusekiKnowledgeGraphAdapter(configuration)
        raise UnsupportedConnectorPortError(
            f"No knowledge graph adapter configured for vendor: {vendor or 'unknown'}"
        )

    factory = AdapterFactory(session)
    return factory._resolve(type_value)
