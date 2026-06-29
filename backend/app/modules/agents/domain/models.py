"""Domain models for the agents module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.agents.domain.enums import AgentDefinitionStatus


@dataclass(slots=True)
class AgentDefinition:
    """Agent definition aggregate root (DM-009)."""

    id: UUID
    application_id: UUID
    version_number: int
    status: AgentDefinitionStatus
    title: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    agent_definition: dict[str, Any]
    bound_product_ids: list[str]
    previous_version_id: UUID | None = None
    description: str | None = None
    approved_at: datetime | None = None
    activated_at: datetime | None = None
    version_created_at: datetime | None = None
