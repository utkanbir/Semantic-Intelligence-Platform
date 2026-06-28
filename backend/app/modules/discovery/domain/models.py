"""Pure domain models for the discovery module."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.discovery.domain.enums import DiscoverySessionStatus


@dataclass(slots=True)
class DiscoveryPhaseHistory:
    """Append-only phase history entry (R-007)."""

    id: UUID
    session_id: UUID
    phase_number: int
    phase_name: str
    entered_at: datetime
    notes: str | None = None


@dataclass(slots=True)
class CurrentPhase:
    """Derived current phase from latest history entry."""

    phase_number: int
    phase_name: str


@dataclass(slots=True)
class DiscoverySession:
    """Discovery session aggregate root (DM-004)."""

    id: UUID
    application_id: UUID
    status: DiscoverySessionStatus
    title: str
    started_by: str
    started_at: datetime
    completed_at: datetime | None = None
    intent_summary: str | None = None
    discovery_notes: str | None = None
    recommendations: list[Any] | None = None
    generated_blueprint_id: UUID | None = None
    conversation_history: list[Any] | None = None
    phase_history: list[DiscoveryPhaseHistory] = field(default_factory=list)

    @property
    def current_phase(self) -> CurrentPhase | None:
        """Derive current phase from the latest history entry by entered_at."""
        if not self.phase_history:
            return None
        latest = max(self.phase_history, key=lambda entry: entry.entered_at)
        return CurrentPhase(phase_number=latest.phase_number, phase_name=latest.phase_name)
