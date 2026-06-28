"""Repository interfaces for the audit_trace module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.audit_trace.domain.models import TraceStep


class TraceStepRepository(Protocol):
    """Persistence contract for TraceStep operations."""

    def create(self, trace_step: TraceStep) -> TraceStep:
        """Persist a new trace step."""

    def list_by_transaction(self, semantic_transaction_id: UUID) -> Sequence[TraceStep]:
        """Return trace steps for a semantic transaction ordered by step_number."""
