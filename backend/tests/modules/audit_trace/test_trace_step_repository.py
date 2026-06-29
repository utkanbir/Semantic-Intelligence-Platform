"""Repository tests for trace step persistence."""

from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.audit_trace.repositories.orm_models  # noqa: F401
from app.modules.audit_trace.domain.models import TraceStep
from app.modules.audit_trace.repositories.orm_models import Base, SemanticTransaction
from app.modules.audit_trace.repositories.sqlalchemy_repository import SqlAlchemyTraceStepRepository


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
