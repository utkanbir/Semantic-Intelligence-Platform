"""Repository interfaces for the discovery module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.discovery.domain.models import DiscoveryPhaseHistory, DiscoverySession


class DiscoveryRepositoryError(Exception):
    """Base repository error for discovery persistence."""


class DiscoverySessionNotFoundError(DiscoveryRepositoryError):
    """Raised when a discovery session cannot be found."""


class DiscoveryRepository(Protocol):
    """Persistence contract for DiscoverySession aggregate operations."""

    def create(self, session: DiscoverySession) -> DiscoverySession:
        """Persist a new discovery session with its initial phase history."""

    def list_by_application(self, application_id: UUID) -> Sequence[DiscoverySession]:
        """Return all sessions for an application."""

    def get(self, session_id: UUID) -> DiscoverySession | None:
        """Return one session by id, if present."""

    def update(self, session: DiscoverySession) -> DiscoverySession | None:
        """Persist modifications for an existing session (scalar fields only)."""

    def append_phase_history(self, entry: DiscoveryPhaseHistory) -> DiscoveryPhaseHistory:
        """Append a phase history entry (R-007 append-only)."""

    def list_phase_history(self, session_id: UUID) -> Sequence[DiscoveryPhaseHistory]:
        """Return phase history for a session in ascending entered_at order."""
