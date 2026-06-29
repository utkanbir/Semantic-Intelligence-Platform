"""Domain enumerations for the adapters module."""

from __future__ import annotations

from enum import StrEnum


class TechnologyType(StrEnum):
    """Supported technology adapter types (Sprint 8 MVP)."""

    POSTGRESQL = "postgresql"
    MINIO = "minio"
    FUSEKI = "fuseki"
    QDRANT = "qdrant"
    OPENMETADATA = "openmetadata"
    OPENAI = "openai"


class TechnologyAdapterStatus(StrEnum):
    """TechnologyAdapter lifecycle states (ARR-002)."""

    REGISTERED = "Registered"
    CONFIGURED = "Configured"
    ACTIVE = "Active"
    DEPRECATED = "Deprecated"
    RETIRED = "Retired"
