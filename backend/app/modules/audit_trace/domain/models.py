"""Domain models for the audit_trace module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.audit_trace.domain.enums import (
    SemanticTransactionStatus,
    TraceLayer,
    TraceStepStatus,
)


@dataclass(slots=True)
class LayeredTraceStepSpec:
    """Input for a typed trace step on a layered semantic transaction (S38-05)."""

    step_type: str
    layer: TraceLayer
    status: TraceStepStatus = TraceStepStatus.COMPLETED
    message: str | None = None
    input_summary: str | None = None
    output_summary: str | None = None
    duration_ms: int | None = None


@dataclass(slots=True)
class TraceStep:
    """Trace step row linked to a SemanticTransaction (R-014, DM-006 stub)."""

    id: UUID
    semantic_transaction_id: UUID
    step_number: int
    step_type: str
    created_at: datetime
    message: str | None = None
    layer: TraceLayer | None = None
    status: TraceStepStatus | None = None
    input_summary: str | None = None
    output_summary: str | None = None
    duration_ms: int | None = None


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
    status: SemanticTransactionStatus | None = None
    initiated_by: str | None = None
    participating_assets: dict[str, Any] | None = None
