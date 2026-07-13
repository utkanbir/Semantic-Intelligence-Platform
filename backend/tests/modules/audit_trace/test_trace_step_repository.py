"""Repository tests for trace step persistence."""

from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.audit_trace.repositories.orm_models  # noqa: F401
from app.modules.audit_trace.domain.enums import (
    SemanticTransactionStatus,
    TraceLayer,
    TraceStepStatus,
)
from app.modules.audit_trace.domain.models import TraceStep
from app.modules.audit_trace.repositories.orm_models import Base, SemanticTransaction
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceQueryRepository,
    SqlAlchemyTraceStepRepository,
)


@pytest.fixture()
def db_engine() -> Generator[Engine, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(db_engine: Engine) -> Generator[Session, None, None]:
    session = sessionmaker(
        bind=db_engine,
        autoflush=False,
        autocommit=False,
        class_=Session,
    )()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def semantic_transaction_id(db_session: Session) -> UUID:
    transaction_id = uuid4()
    db_session.add(
        SemanticTransaction(
            id=transaction_id,
            transaction_type="asset.created",
            resource_type="AssetRecord",
            resource_id=str(uuid4()),
            created_at=datetime(2026, 6, 28, 18, 0, 0, tzinfo=UTC),
        )
    )
    db_session.commit()
    return transaction_id


def test_create_and_list_trace_steps(
    db_session: Session, semantic_transaction_id: UUID
) -> None:
    repo = SqlAlchemyTraceStepRepository(db_session)
    now = datetime(2026, 6, 28, 18, 0, 0, tzinfo=UTC)

    first = repo.create(
        TraceStep(
            id=uuid4(),
            semantic_transaction_id=semantic_transaction_id,
            step_number=1,
            step_type="validate",
            message="Validated application scope",
            created_at=now,
        )
    )
    repo.create(
        TraceStep(
            id=uuid4(),
            semantic_transaction_id=semantic_transaction_id,
            step_number=2,
            step_type="persist",
            message="Persisted asset record",
            created_at=now,
        )
    )

    assert first.step_type == "validate"

    listed = repo.list_by_transaction(semantic_transaction_id)
    assert len(listed) == 2
    assert listed[0].step_number == 1
    assert listed[1].step_number == 2


def test_list_transactions_batches_trace_step_loading(
    db_session: Session, db_engine: Engine
) -> None:
    trace_repo = SqlAlchemyTraceStepRepository(db_session)
    base_time = datetime(2026, 6, 28, 18, 0, 0, tzinfo=UTC)
    expected_ids: list[UUID] = []
    for index in range(3):
        transaction_id = uuid4()
        created_at = base_time.replace(minute=index)
        db_session.add(
            SemanticTransaction(
                id=transaction_id,
                transaction_type=f"ontology.event{index}",
                resource_type="OntologyDefinition",
                resource_id=str(uuid4()),
                created_at=created_at,
            )
        )
        db_session.commit()
        trace_repo.create(
            TraceStep(
                id=uuid4(),
                semantic_transaction_id=transaction_id,
                step_number=1,
                step_type="persist",
                message=f"step-1-{index}",
                created_at=created_at,
            )
        )
        trace_repo.create(
            TraceStep(
                id=uuid4(),
                semantic_transaction_id=transaction_id,
                step_number=2,
                step_type="publish",
                message=f"step-2-{index}",
                created_at=created_at,
            )
        )
        expected_ids.insert(0, transaction_id)

    select_statements: list[str] = []

    def before_cursor_execute(
        _conn, _cursor, statement, _parameters, _context, _executemany
    ) -> None:
        if statement.lstrip().upper().startswith("SELECT"):
            select_statements.append(statement)

    event.listen(db_engine, "before_cursor_execute", before_cursor_execute)
    try:
        repo = SqlAlchemyAuditTraceQueryRepository(db_session)
        records = repo.list_transactions(limit=3)
    finally:
        event.remove(db_engine, "before_cursor_execute", before_cursor_execute)

    assert [record.id for record in records] == expected_ids
    assert all(len(record.trace_steps) == 2 for record in records)
    assert [step.step_number for step in records[0].trace_steps] == [1, 2]
    assert len(select_statements) == 2


def test_create_trace_step_with_extension_fields(
    db_session: Session, semantic_transaction_id: UUID
) -> None:
    repo = SqlAlchemyTraceStepRepository(db_session)
    now = datetime(2026, 7, 9, 12, 0, 0, tzinfo=UTC)
    step_id = uuid4()

    created = repo.create(
        TraceStep(
            id=step_id,
            semantic_transaction_id=semantic_transaction_id,
            step_number=1,
            step_type="QuestionReceived",
            message="User asked about Invoice class",
            created_at=now,
            layer=TraceLayer.EXPERIENCE,
            status=TraceStepStatus.COMPLETED,
            input_summary="question=What is Invoice?",
            output_summary="accepted",
            duration_ms=12,
        )
    )

    assert created.layer is TraceLayer.EXPERIENCE
    assert created.status is TraceStepStatus.COMPLETED
    assert created.duration_ms == 12

    query_repo = SqlAlchemyAuditTraceQueryRepository(db_session)
    record = query_repo.get_transaction(semantic_transaction_id)
    assert record is not None
    assert record.status is SemanticTransactionStatus.COMPLETED
    assert len(record.trace_steps) == 1
    assert record.trace_steps[0].input_summary == "question=What is Invoice?"
