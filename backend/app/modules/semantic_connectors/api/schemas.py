"""Pydantic request/response schemas for the semantic_connectors module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.semantic_connectors.domain.enums import (
    SemanticConnectorStatus,
    SemanticConnectorType,
)
from app.modules.semantic_connectors.domain.models import SemanticConnector


class SemanticConnectorResponse(BaseModel):
    id: UUID
    connector_key: str
    connector_type: SemanticConnectorType
    status: SemanticConnectorStatus
    title: str
    description: str | None = None
    technology_adapter_id: UUID
    created_by: str
    created_at: datetime
    updated_at: datetime
    connector_configuration: dict[str, Any]


class SemanticConnectorCreateRequest(BaseModel):
    connector_key: str = Field(min_length=1, max_length=255)
    connector_type: SemanticConnectorType
    title: str = Field(min_length=1, max_length=255)
    technology_adapter_id: UUID
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    connector_configuration: dict[str, Any] | None = None


def to_semantic_connector_response(connector: SemanticConnector) -> SemanticConnectorResponse:
    return SemanticConnectorResponse(
        id=connector.id,
        connector_key=connector.connector_key,
        connector_type=connector.connector_type,
        status=connector.status,
        title=connector.title,
        description=connector.description,
        technology_adapter_id=connector.technology_adapter_id,
        created_by=connector.created_by,
        created_at=connector.created_at,
        updated_at=connector.updated_at,
        connector_configuration=connector.connector_configuration,
    )
