"""Domain models for the audit_trace module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class TraceStep:
    """Trace step row linked to a SemanticTransaction (R-014, DM-006 stub)."""

    id: UUID
    semantic_transaction_id: UUID
    step_number: int
    step_type: str
    created_at: datetime
    message: str | None = None


@dataclass(slots=True)
class SemanticTransactionRecord:
    """Semantic transaction audit log row (read model)."""

    id: UUID
    transaction_type: str
    resource_type: str
    resource_id: str
    created_at: datetime
    trace_steps: list[TraceStep]
    application_id: UUID | None = None
