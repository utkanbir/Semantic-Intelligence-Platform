"""Domain enumerations for the semantic_connectors module."""

from __future__ import annotations

from enum import StrEnum


class SemanticConnectorType(StrEnum):
    """Platform semantic connector roles."""

    ONTOLOGY_STORE = "ontology_store"
    KNOWLEDGE_GRAPH_STORE = "knowledge_graph_store"


class SemanticConnectorStatus(StrEnum):
    """SemanticConnector lifecycle states."""

    ACTIVE = "Active"
    RETIRED = "Retired"
