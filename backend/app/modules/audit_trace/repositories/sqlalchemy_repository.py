"""SQLAlchemy repository implementations for the audit_trace module."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit_trace.domain.enums import (
    SemanticTransactionMode,
    SemanticTransactionStatus,
    TraceLayer,
    TraceStepStatus,
)
from app.modules.audit_trace.domain.models import (
    LayeredTraceStepSpec,
    SemanticTransactionRecord,
    TraceStep,
)
from app.modules.audit_trace.domain.trace_audience import (
    OPERATIONAL_AUDIT_TRANSACTION_TYPES,
    PLATFORM_PROVISIONING_TRANSACTION_TYPES,
    SEMANTIC_LINEAGE_TRANSACTION_TYPES,
    TraceAudience,
)
from app.modules.audit_trace.repositories.interfaces import TraceStepRepository
from app.modules.audit_trace.repositories.orm_models import (
    SemanticTransaction,
)
from app.modules.audit_trace.repositories.orm_models import (
    TraceStep as TraceStepORM,
)


def _parse_trace_layer(value: str | None) -> TraceLayer | None:
    return TraceLayer(value) if value else None


def _parse_trace_step_status(value: str | None) -> TraceStepStatus | None:
    return TraceStepStatus(value) if value else None


def _parse_transaction_status(value: str | None) -> SemanticTransactionStatus | None:
    return SemanticTransactionStatus(value) if value else None


def _parse_transaction_mode(value: str | None) -> SemanticTransactionMode | None:
    return SemanticTransactionMode(value) if value else None


def _to_domain(trace_step_orm: TraceStepORM) -> TraceStep:
    return TraceStep(
        id=trace_step_orm.id,
        semantic_transaction_id=trace_step_orm.semantic_transaction_id,
        step_number=trace_step_orm.step_number,
        step_type=trace_step_orm.step_type,
        message=trace_step_orm.message,
        created_at=trace_step_orm.created_at,
        layer=_parse_trace_layer(trace_step_orm.layer),
        status=_parse_trace_step_status(trace_step_orm.status),
        input_summary=trace_step_orm.input_summary,
        output_summary=trace_step_orm.output_summary,
        duration_ms=trace_step_orm.duration_ms,
    )


def _transaction_types_for_audience(trace_audience: TraceAudience) -> frozenset[str]:
    if trace_audience is TraceAudience.SEMANTIC_LINEAGE:
        return SEMANTIC_LINEAGE_TRANSACTION_TYPES
    if trace_audience is TraceAudience.OPERATIONAL_AUDIT:
        return OPERATIONAL_AUDIT_TRANSACTION_TYPES
    return PLATFORM_PROVISIONING_TRANSACTION_TYPES


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
        application_id: UUID | None = None,
    ) -> None:
        from app.modules.audit_trace.repositories.orm_models import SemanticTransaction

        semantic_transaction = SemanticTransaction(
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
            application_id=application_id,
        )
        self._session.add(semantic_transaction)
        self._session.commit()

    def record_transaction_with_steps(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
        application_id: UUID | None,
        steps: Sequence[tuple[str, str | None]],
    ) -> UUID:
        from app.modules.audit_trace.repositories.orm_models import SemanticTransaction

        transaction_id = uuid4()
        now = datetime.now(UTC)
        semantic_transaction = SemanticTransaction(
            id=transaction_id,
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
            application_id=application_id,
            created_at=now,
        )
        self._session.add(semantic_transaction)
        for step_number, (step_type, message) in enumerate(steps, start=1):
            self._session.add(
                TraceStepORM(
                    id=uuid4(),
                    semantic_transaction_id=transaction_id,
                    step_number=step_number,
                    step_type=step_type,
                    message=message,
                    created_at=now,
                )
            )
        self._session.commit()
        return transaction_id

    def begin_semantic_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
        application_id: UUID | None,
        initiated_by: str | None = None,
        participating_assets: dict | None = None,
        question_text: str | None = None,
        started_at: datetime | None = None,
        mode: str | None = None,
    ) -> UUID:
        """Create a Running semantic transaction before layered steps are appended."""
        transaction_id = uuid4()
        now = datetime.now(UTC)
        semantic_transaction = SemanticTransaction(
            id=transaction_id,
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
            application_id=application_id,
            status=SemanticTransactionStatus.RUNNING.value,
            initiated_by=initiated_by,
            participating_assets=participating_assets,
            question_text=question_text,
            started_at=started_at or now,
            mode=mode,
            created_at=now,
        )
        self._session.add(semantic_transaction)
        self._session.commit()
        return transaction_id

    def append_layered_step(
        self,
        transaction_id: UUID,
        *,
        step_number: int,
        spec: LayeredTraceStepSpec,
    ) -> None:
        """Append one typed trace step and commit for live trace polling."""
        now = datetime.now(UTC)
        self._session.add(
            TraceStepORM(
                id=uuid4(),
                semantic_transaction_id=transaction_id,
                step_number=step_number,
                step_type=spec.step_type,
                message=spec.message,
                layer=spec.layer.value,
                status=spec.status.value,
                input_summary=spec.input_summary,
                output_summary=spec.output_summary,
                duration_ms=spec.duration_ms,
                created_at=now,
            )
        )
        self._session.commit()

    def finalize_semantic_transaction(
        self,
        transaction_id: UUID,
        *,
        status: SemanticTransactionStatus,
        answer_text: str | None = None,
        completed_at: datetime | None = None,
        total_duration_ms: int | None = None,
    ) -> None:
        """Set the final semantic transaction status."""
        transaction = self._session.get(SemanticTransaction, transaction_id)
        if transaction is None:
            raise ValueError(f"SemanticTransaction {transaction_id} not found")
        transaction.status = status.value
        if answer_text is not None:
            transaction.answer_text = answer_text
        if completed_at is not None:
            transaction.completed_at = completed_at
        if total_duration_ms is not None:
            transaction.total_duration_ms = total_duration_ms
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
            layer=trace_step.layer.value if trace_step.layer else None,
            status=trace_step.status.value if trace_step.status else None,
            input_summary=trace_step.input_summary,
            output_summary=trace_step.output_summary,
            duration_ms=trace_step.duration_ms,
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
        application_id=transaction_orm.application_id,
        status=_parse_transaction_status(transaction_orm.status),
        initiated_by=transaction_orm.initiated_by,
        participating_assets=transaction_orm.participating_assets,
        question_text=transaction_orm.question_text,
        answer_text=transaction_orm.answer_text,
        started_at=transaction_orm.started_at,
        completed_at=transaction_orm.completed_at,
        total_duration_ms=transaction_orm.total_duration_ms,
        mode=_parse_transaction_mode(transaction_orm.mode),
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

    def _load_records(
        self,
        statement,
    ) -> Sequence[SemanticTransactionRecord]:
        transactions = self._session.scalars(statement).all()
        if not transactions:
            return []

        transaction_ids = [transaction.id for transaction in transactions]
        trace_steps_by_transaction = self._list_trace_steps_by_transaction_ids(transaction_ids)
        return [
            _to_transaction_record(
                transaction,
                trace_steps_by_transaction.get(transaction.id, []),
            )
            for transaction in transactions
        ]

    def _list_trace_steps_by_transaction_ids(
        self,
        transaction_ids: Sequence[UUID],
    ) -> dict[UUID, list[TraceStep]]:
        statement = (
            select(TraceStepORM)
            .where(TraceStepORM.semantic_transaction_id.in_(transaction_ids))
            .order_by(TraceStepORM.semantic_transaction_id.asc(), TraceStepORM.step_number.asc())
        )
        trace_steps_by_transaction: dict[UUID, list[TraceStep]] = defaultdict(list)
        for trace_step_orm in self._session.scalars(statement).all():
            trace_steps_by_transaction[trace_step_orm.semantic_transaction_id].append(
                _to_domain(trace_step_orm)
            )
        return dict(trace_steps_by_transaction)

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
        statement = select(SemanticTransaction).order_by(SemanticTransaction.created_at.desc())
        if resource_id is not None:
            statement = statement.where(SemanticTransaction.resource_id == resource_id)
        if application_id is not None:
            statement = statement.where(SemanticTransaction.application_id == application_id)
        if resource_type is not None:
            statement = statement.where(SemanticTransaction.resource_type == resource_type)
        if transaction_type_prefix is not None:
            statement = statement.where(
                SemanticTransaction.transaction_type.startswith(transaction_type_prefix)
            )
        if trace_audience is not None:
            statement = statement.where(
                SemanticTransaction.transaction_type.in_(
                    _transaction_types_for_audience(trace_audience)
                )
            )
        if limit is not None:
            statement = statement.limit(limit)
        return self._load_records(statement)

    def list_by_resource_id(self, resource_id: str) -> Sequence[SemanticTransactionRecord]:
        return self.list_transactions(
            resource_id=resource_id,
        )

    def list_by_application_id(
        self,
        application_id: UUID,
        *,
        resource_type: str | None = None,
        transaction_type_prefix: str | None = None,
    ) -> Sequence[SemanticTransactionRecord]:
        return self.list_transactions(
            application_id=application_id,
            resource_type=resource_type,
            transaction_type_prefix=transaction_type_prefix,
        )
