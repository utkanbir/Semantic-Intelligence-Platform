"""Pydantic request/response schemas for the adapters module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.adapters.domain.enums import TechnologyAdapterStatus, TechnologyType
from app.modules.adapters.domain.models import TechnologyAdapter


class TechnologyAdapterResponse(BaseModel):
    id: UUID
    technology_type: TechnologyType
    adapter_key: str
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
    adapter_configuration: dict[str, Any]


class TechnologyAdapterCreateRequest(BaseModel):
    technology_type: TechnologyType
    adapter_key: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    adapter_configuration: dict[str, Any] | None = None


class TechnologyAdapterUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    adapter_configuration: dict[str, Any] | None = None


class TechnologyAdapterStatusUpdateRequest(BaseModel):
    status: TechnologyAdapterStatus


class AdapterPingResponse(BaseModel):
    status: str
    technology: str


def to_technology_adapter_response(
    adapter: TechnologyAdapter,
) -> TechnologyAdapterResponse:
    return TechnologyAdapterResponse(
        id=adapter.id,
        technology_type=adapter.technology_type,
        adapter_key=adapter.adapter_key,
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
        adapter_configuration=adapter.adapter_configuration,
    )
