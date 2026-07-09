"""Pydantic request/response schemas for the audit_trace module."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.modules.audit_trace.domain.models import SemanticTransactionRecord, TraceStep


class TraceStepResponse(BaseModel):
    """Trace step response payload."""

    id: UUID
    semantic_transaction_id: UUID
    step_number: int
    step_type: str
    message: str | None = None
    created_at: datetime
    layer: str | None = None
    status: str | None = None
    input_summary: str | None = None
    output_summary: str | None = None
    duration_ms: int | None = None


class SemanticTransactionResponse(BaseModel):
    """Semantic transaction response with nested trace steps."""

    id: UUID
    transaction_type: str
    resource_type: str
    resource_id: str
    created_at: datetime
    trace_steps: list[TraceStepResponse]
    application_id: UUID | None = None
    status: str | None = None
    initiated_by: str | None = None
    participating_assets: dict | None = None


def to_trace_step_response(trace_step: TraceStep) -> TraceStepResponse:
    return TraceStepResponse(
        id=trace_step.id,
        semantic_transaction_id=trace_step.semantic_transaction_id,
        step_number=trace_step.step_number,
        step_type=trace_step.step_type,
        message=trace_step.message,
        created_at=trace_step.created_at,
        layer=trace_step.layer.value if trace_step.layer else None,
        status=trace_step.status.value if trace_step.status else None,
        input_summary=trace_step.input_summary,
        output_summary=trace_step.output_summary,
        duration_ms=trace_step.duration_ms,
    )


def to_semantic_transaction_response(
    record: SemanticTransactionRecord,
) -> SemanticTransactionResponse:
    return SemanticTransactionResponse(
        id=record.id,
        transaction_type=record.transaction_type,
        resource_type=record.resource_type,
        resource_id=record.resource_id,
        created_at=record.created_at,
        trace_steps=[to_trace_step_response(step) for step in record.trace_steps],
        application_id=record.application_id,
        status=record.status.value if record.status else None,
        initiated_by=record.initiated_by,
        participating_assets=record.participating_assets,
    )
