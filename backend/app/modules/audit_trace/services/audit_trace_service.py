"""Application services for the audit_trace module."""

from __future__ import annotations

from uuid import UUID

from app.modules.audit_trace.domain.models import SemanticTransactionRecord
from app.modules.audit_trace.domain.trace_audience import TraceAudience, resolve_trace_audience
from app.modules.audit_trace.repositories.interfaces import AuditTraceQueryRepository


class SemanticTransactionNotFoundError(Exception):
    """Raised when a semantic transaction cannot be found."""


class AuditTraceService:
    """Read-only audit trace query orchestration."""

    def __init__(self, repository: AuditTraceQueryRepository) -> None:
        self._repository = repository

    def get_transaction(self, transaction_id: UUID) -> SemanticTransactionRecord:
        record = self._repository.get_transaction(transaction_id)
        if record is None:
            raise SemanticTransactionNotFoundError("Semantic transaction not found")
        return record

    def list_transactions(
        self,
        *,
        resource_id: str | None = None,
        application_id: UUID | None = None,
        resource_type: str | None = None,
        transaction_type_prefix: str | None = None,
        trace_audience: TraceAudience | None = None,
        limit: int,
    ) -> list[SemanticTransactionRecord]:
        return list(
            self._repository.list_transactions(
                resource_id=resource_id,
                application_id=application_id,
                resource_type=resource_type,
                transaction_type_prefix=transaction_type_prefix,
                trace_audience=trace_audience,
                limit=limit,
            )
        )

    def get_semantic_lineage_transaction(self, transaction_id: UUID) -> SemanticTransactionRecord:
        record = self.get_transaction(transaction_id)
        if resolve_trace_audience(record.transaction_type) is not TraceAudience.SEMANTIC_LINEAGE:
            raise SemanticTransactionNotFoundError("Semantic transaction not found")
        return record

    def list_by_resource_id(self, resource_id: str) -> list[SemanticTransactionRecord]:
        return list(self._repository.list_by_resource_id(resource_id))

    def list_by_application_id(
        self,
        application_id: UUID,
        *,
        resource_type: str | None = None,
        transaction_type_prefix: str | None = None,
    ) -> list[SemanticTransactionRecord]:
        return list(
            self._repository.list_by_application_id(
                application_id,
                resource_type=resource_type,
                transaction_type_prefix=transaction_type_prefix,
            )
        )
