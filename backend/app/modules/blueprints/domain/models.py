"""Pure domain models for the blueprints module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.blueprints.domain.enums import BlueprintStatus


@dataclass(slots=True)
class Blueprint:
    """Blueprint aggregate root (DM-003)."""

    id: UUID
    application_id: UUID
    version_number: int
    status: BlueprintStatus
    title: str
    created_by: str
    created_at: datetime
    blueprint_snapshot: dict[str, Any]
    previous_version_id: UUID | None = None
    goal: str | None = None
    outcome: str | None = None
    approved_at: datetime | None = None
    version_created_at: datetime | None = None
