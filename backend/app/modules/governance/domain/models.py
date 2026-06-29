"""Domain models for the governance module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.governance.domain.enums import PolicyDefinitionStatus


@dataclass(slots=True)
class PolicyDefinition:
    """Policy definition aggregate root (DM-010)."""

    id: UUID
    policy_key: str
    status: PolicyDefinitionStatus
    title: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    policy_definition: dict[str, Any]
    description: str | None = None
    approved_at: datetime | None = None
    activated_at: datetime | None = None
    retired_at: datetime | None = None
