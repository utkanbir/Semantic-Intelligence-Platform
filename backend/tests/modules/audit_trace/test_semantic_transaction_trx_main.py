"""Tests for ADR-002 trx_main migration and repository mapping (S39-01)."""

from __future__ import annotations

import importlib.util
from collections.abc import Generator
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.audit_trace.repositories.orm_models  # noqa: F401
from app.modules.audit_trace.domain.enums import (
    SemanticTransactionMode,
    SemanticTransactionStatus,
)
from app.modules.audit_trace.domain.models import SemanticTransactionRecord
from app.modules.audit_trace.repositories.orm_models import Base, SemanticTransaction
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
    _to_transaction_record,
)


def _load_migration_module(filename: str):
    path = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "alembic"
        / "versions"
        / filename
    )
    spec = importlib.util.spec_from_file_location(filename.replace(".py", ""), path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_trx_main_migration_revision_chain() -> None:
    migration = _load_migration_module("20260712_0021_semantic_transaction_trx_main_fields.py")
    assert migration.revision == "20260712_0021"
    assert migration.down_revision == "20260709_0020"


def test_to_transaction_record_maps_trx_main_fields() -> None:
    started_at = datetime(2026, 7, 12, 10, 0, 0, tzinfo=UTC)
    completed_at = datetime(2026, 7, 12, 10, 0, 1, 500000, tzinfo=UTC)
    transaction_id = uuid4()
    transaction_orm = SemanticTransaction(
        id=transaction_id,
        transaction_type="chat.query",
        resource_type="Conversation",
        resource_id="conv-1",
        created_at=started_at,
        question_text="What is revenue?",
        answer_text="Revenue is ...",
        started_at=started_at,
        completed_at=completed_at,
        total_duration_ms=1500,
        mode=SemanticTransactionMode.RICH.value,
    )
    record = _to_transaction_record(transaction_orm, [])
    assert isinstance(record, SemanticTransactionRecord)
    assert record.question_text == "What is revenue?"
    assert record.answer_text == "Revenue is ..."
    assert record.started_at == started_at
    assert record.completed_at == completed_at
    assert record.total_duration_ms == 1500
    assert record.mode is SemanticTransactionMode.RICH


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


def test_begin_and_finalize_persist_trx_main_fields(db_session: Session) -> None:
    repo = SqlAlchemyAuditTraceRepository(db_session)
    started_at = datetime(2026, 7, 12, 10, 0, 0, tzinfo=UTC)
    completed_at = datetime(2026, 7, 12, 10, 0, 2, tzinfo=UTC)
    question = "Q" * 800
    answer = "A" * 900

    transaction_id = repo.begin_semantic_transaction(
        transaction_type="ontology.question_answered",
        resource_type="OntologyDefinition",
        resource_id=str(uuid4()),
        application_id=None,
        question_text=question,
        started_at=started_at,
        mode=SemanticTransactionMode.RICH.value,
    )
    repo.finalize_semantic_transaction(
        transaction_id,
        status=SemanticTransactionStatus.COMPLETED,
        answer_text=answer,
        completed_at=completed_at,
        total_duration_ms=2000,
    )

    transaction = db_session.get(SemanticTransaction, transaction_id)
    assert transaction is not None
    assert transaction.question_text == question
    assert transaction.answer_text == answer
    assert transaction.started_at.replace(tzinfo=UTC) == started_at
    assert transaction.completed_at.replace(tzinfo=UTC) == completed_at
    assert transaction.total_duration_ms == 2000
    assert transaction.mode == SemanticTransactionMode.RICH.value
    assert transaction.status == SemanticTransactionStatus.COMPLETED.value


def test_finalize_failure_persists_duration_without_answer(db_session: Session) -> None:
    repo = SqlAlchemyAuditTraceRepository(db_session)
    started_at = datetime(2026, 7, 12, 11, 0, 0, tzinfo=UTC)
    completed_at = datetime(2026, 7, 12, 11, 0, 1, tzinfo=UTC)

    transaction_id = repo.begin_semantic_transaction(
        transaction_type="ontology.question_answered",
        resource_type="OntologyDefinition",
        resource_id=str(uuid4()),
        application_id=None,
        question_text="What failed?",
        started_at=started_at,
        mode=SemanticTransactionMode.RICH.value,
    )
    repo.finalize_semantic_transaction(
        transaction_id,
        status=SemanticTransactionStatus.FAILED,
        completed_at=completed_at,
        total_duration_ms=1000,
    )

    transaction = db_session.get(SemanticTransaction, transaction_id)
    assert transaction is not None
    assert transaction.answer_text is None
    assert transaction.completed_at.replace(tzinfo=UTC) == completed_at
    assert transaction.total_duration_ms == 1000
    assert transaction.status == SemanticTransactionStatus.FAILED.value
