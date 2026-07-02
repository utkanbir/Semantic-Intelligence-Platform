"""Domain models for the adapters module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.adapters.domain.enums import ConnectorType, TechnologyAdapterStatus


@dataclass(slots=True)
class TechnologyAdapter:
    """Technology adapter registry aggregate root."""

    id: UUID
    technology_type: ConnectorType
    adapter_key: str
    status: TechnologyAdapterStatus
    title: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    adapter_configuration: dict[str, Any]
    description: str | None = None
    configured_at: datetime | None = None
    activated_at: datetime | None = None
    deprecated_at: datetime | None = None
    retired_at: datetime | None = None
