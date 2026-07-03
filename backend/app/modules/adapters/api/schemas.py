"""Pydantic request/response schemas for the adapters module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.adapters.domain.enums import ConnectorType, TechnologyAdapterStatus
from app.modules.adapters.domain.models import TechnologyAdapter


class TechnologyAdapterResponse(BaseModel):
    id: UUID
    connector_type: ConnectorType
    connector_key: str
    status: TechnologyAdapterStatus
    title: str
    description: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    configured_at: datetime | None = None
    activated_at: datetime | None = None
    deprecated_at: datetime | None = None
    retired_at: datetime | None = None
    connector_configuration: dict[str, Any]


class TechnologyAdapterCreateRequest(BaseModel):
    connector_type: ConnectorType
    connector_key: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    connector_configuration: dict[str, Any] | None = None


class TechnologyAdapterUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    connector_configuration: dict[str, Any] | None = None


class TechnologyAdapterStatusUpdateRequest(BaseModel):
    status: TechnologyAdapterStatus


class AdapterPingResponse(BaseModel):
    status: str
    connector_type: str


class ConnectorProvisionResponse(BaseModel):
    connector_id: UUID
    status: str
    endpoint: str | None = None
    started_at: str | None = None
    completed_at: str | None = None


def to_technology_adapter_response(
    adapter: TechnologyAdapter,
) -> TechnologyAdapterResponse:
    return TechnologyAdapterResponse(
        id=adapter.id,
        connector_type=adapter.technology_type,
        connector_key=adapter.adapter_key,
        status=adapter.status,
        title=adapter.title,
        description=adapter.description,
        created_by=adapter.created_by,
        created_at=adapter.created_at,
        updated_at=adapter.updated_at,
        configured_at=adapter.configured_at,
        activated_at=adapter.activated_at,
        deprecated_at=adapter.deprecated_at,
        retired_at=adapter.retired_at,
        connector_configuration=adapter.adapter_configuration,
    )
