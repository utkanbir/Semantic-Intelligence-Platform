"""Domain models for the semantic_connectors module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.semantic_connectors.domain.enums import (
    SemanticConnectorStatus,
    SemanticConnectorType,
)


@dataclass(slots=True)
class SemanticConnector:
    """Platform semantic connector bound to a technology adapter."""

    id: UUID
    connector_key: str
    connector_type: SemanticConnectorType
    status: SemanticConnectorStatus
    title: str
    technology_adapter_id: UUID
    created_by: str
    created_at: datetime
    updated_at: datetime
    connector_configuration: dict[str, Any]
    description: str | None = None
