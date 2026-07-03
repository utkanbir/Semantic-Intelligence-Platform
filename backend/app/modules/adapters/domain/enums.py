"""Domain enumerations for the adapters module."""

from __future__ import annotations

from enum import StrEnum


class ConnectorType(StrEnum):
    """Platform connector types."""

    DATABASE = "database"
    OBJECT_STORAGE = "object_storage"
    FILE_SYSTEM = "file_system"
    ONTOLOGY_KNOWLEDGE_GRAPH = "ontology_knowledge_graph"


# Backward-compatible alias for internal imports during transition.
TechnologyType = ConnectorType


class TechnologyAdapterStatus(StrEnum):
    """TechnologyAdapter lifecycle states (ARR-002)."""

    REGISTERED = "Registered"
    CONFIGURED = "Configured"
    ACTIVE = "Active"
    DEPRECATED = "Deprecated"
    RETIRED = "Retired"


class ConnectionMethod(StrEnum):
    """How a connector reaches its backing technology."""

    EXISTING_INSTANCE = "existing_instance"
    PROVISION_IN_CLUSTER = "provision_in_cluster"


class ProvisionStatus(StrEnum):
    """In-cluster connector provisioning lifecycle."""

    PROVISIONING = "provisioning"
    PROVISIONED = "provisioned"
    FAILED = "failed"
