"""SQLAlchemy repository implementations for the audit_trace module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit_trace.domain.models import SemanticTransactionRecord, TraceStep
from app.modules.audit_trace.repositories.interfaces import TraceStepRepository
from app.modules.audit_trace.repositories.orm_models import (
    SemanticTransaction,
)
from app.modules.audit_trace.repositories.orm_models import (
    TraceStep as TraceStepORM,
)


def _to_domain(trace_step_orm: TraceStepORM) -> TraceStep:
    return TraceStep(
        id=trace_step_orm.id,
        semantic_transaction_id=trace_step_orm.semantic_transaction_id,
        step_number=trace_step_orm.step_number,
        step_type=trace_step_orm.step_type,
        message=trace_step_orm.message,
        created_at=trace_step_orm.created_at,
    )


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
        from app.modules.audit_trace.repositories.orm_models import SemanticTransaction

        semantic_transaction = SemanticTransaction(
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
        )
        self._session.add(semantic_transaction)
        self._session.commit()


class SqlAlchemyTraceStepRepository(TraceStepRepository):
    """SQLAlchemy-backed persistence for trace step records."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, trace_step: TraceStep) -> TraceStep:
        trace_step_orm = TraceStepORM(
            id=trace_step.id,
            semantic_transaction_id=trace_step.semantic_transaction_id,
            step_number=trace_step.step_number,
            step_type=trace_step.step_type,
            message=trace_step.message,
            created_at=trace_step.created_at,
        )
        self._session.add(trace_step_orm)
        self._session.commit()
        self._session.refresh(trace_step_orm)
        return _to_domain(trace_step_orm)

    def list_by_transaction(self, semantic_transaction_id: UUID) -> Sequence[TraceStep]:
        statement = (
            select(TraceStepORM)
            .where(TraceStepORM.semantic_transaction_id == semantic_transaction_id)
            .order_by(TraceStepORM.step_number.asc())
        )
        return [_to_domain(item) for item in self._session.scalars(statement).all()]


def _to_transaction_record(
    transaction_orm: SemanticTransaction,
    steps: Sequence[TraceStep],
) -> SemanticTransactionRecord:
    return SemanticTransactionRecord(
        id=transaction_orm.id,
        transaction_type=transaction_orm.transaction_type,
        resource_type=transaction_orm.resource_type,
        resource_id=transaction_orm.resource_id,
        created_at=transaction_orm.created_at,
        trace_steps=list(steps),
    )


class SqlAlchemyAuditTraceQueryRepository:
    """Read-only SQLAlchemy queries for semantic transactions."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._trace_steps = SqlAlchemyTraceStepRepository(session)

    def get_transaction(self, transaction_id: UUID) -> SemanticTransactionRecord | None:
        transaction_orm = self._session.get(SemanticTransaction, transaction_id)
        if transaction_orm is None:
            return None
        steps = self._trace_steps.list_by_transaction(transaction_id)
        return _to_transaction_record(transaction_orm, steps)

    def list_by_resource_id(self, resource_id: str) -> Sequence[SemanticTransactionRecord]:
        statement = (
            select(SemanticTransaction)
            .where(SemanticTransaction.resource_id == resource_id)
            .order_by(SemanticTransaction.created_at.desc())
        )
        records: list[SemanticTransactionRecord] = []
        for transaction_orm in self._session.scalars(statement).all():
            steps = self._trace_steps.list_by_transaction(transaction_orm.id)
            records.append(_to_transaction_record(transaction_orm, steps))
        return records
