"""Resolve KnowledgeGraphPort implementations from connector configuration."""

from __future__ import annotations

from app.infrastructure.adapters.fuseki import FusekiKnowledgeGraphAdapter
from app.modules.adapters.domain.models import TechnologyAdapter
from app.modules.adapters.services.connector_provision import read_vendor
from app.shared.ports.knowledge_graph import KnowledgeGraphPort


class UnsupportedKnowledgeGraphVendorError(Exception):
    """Raised when no adapter exists for the connector vendor."""


def resolve_knowledge_graph_port(adapter: TechnologyAdapter) -> KnowledgeGraphPort:
    vendor = read_vendor(adapter.adapter_configuration)
    if vendor == "apache_fuseki":
        return FusekiKnowledgeGraphAdapter(adapter.adapter_configuration)
    raise UnsupportedKnowledgeGraphVendorError(
        f"No knowledge graph adapter configured for vendor: {vendor or 'unknown'}"
    )
