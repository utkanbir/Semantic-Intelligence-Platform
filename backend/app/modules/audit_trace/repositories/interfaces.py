"""Repository interfaces for the audit_trace module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.audit_trace.domain.models import SemanticTransactionRecord, TraceStep
from app.modules.audit_trace.domain.trace_audience import TraceAudience


class TraceStepRepository(Protocol):
    """Persistence contract for TraceStep operations."""

    def create(self, trace_step: TraceStep) -> TraceStep:
        """Persist a new trace step."""

    def list_by_transaction(self, semantic_transaction_id: UUID) -> Sequence[TraceStep]:
        """Return trace steps for a semantic transaction ordered by step_number."""


class AuditTraceQueryRepository(Protocol):
    """Read-only persistence for semantic transaction queries."""

    def get_transaction(self, transaction_id: UUID) -> SemanticTransactionRecord | None:
        """Return one semantic transaction with trace steps."""

    def list_transactions(
        self,
        *,
        resource_id: str | None = None,
        application_id: UUID | None = None,
        resource_type: str | None = None,
        transaction_type_prefix: str | None = None,
        trace_audience: TraceAudience | None = None,
        limit: int | None = None,
    ) -> Sequence[SemanticTransactionRecord]:
        """Return semantic transactions using the supplied optional filters."""

    def list_by_resource_id(self, resource_id: str) -> Sequence[SemanticTransactionRecord]:
        """Return semantic transactions for a resource id with trace steps."""

    def list_by_application_id(
        self,
        application_id: UUID,
        *,
        resource_type: str | None = None,
        transaction_type_prefix: str | None = None,
    ) -> Sequence[SemanticTransactionRecord]:
        """Return semantic transactions scoped to an application."""
