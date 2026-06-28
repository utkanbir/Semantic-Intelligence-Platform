"""SQLAlchemy repository implementations for the audit_trace module."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.modules.audit_trace.repositories.orm_models import SemanticTransaction


class SqlAlchemyAuditTraceRepository:
    """SQLAlchemy-backed persistence for semantic transaction records."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        semantic_transaction = SemanticTransaction(
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
        )
        self._session.add(semantic_transaction)
        self._session.commit()
