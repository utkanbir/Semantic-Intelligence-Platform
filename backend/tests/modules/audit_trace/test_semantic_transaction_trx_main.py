"""Tests for ADR-002 trx_main migration and repository mapping (S39-01)."""

from __future__ import annotations

import importlib.util
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.modules.audit_trace.domain.enums import SemanticTransactionMode
from app.modules.audit_trace.domain.models import SemanticTransactionRecord
from app.modules.audit_trace.repositories.orm_models import SemanticTransaction
from app.modules.audit_trace.repositories.sqlalchemy_repository import _to_transaction_record


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
