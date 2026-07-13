"""Tests for audit_trace domain + ORM models."""

from app.modules.audit_trace.repositories.orm_models import SemanticTransaction, TraceStep


def test_trace_step_requires_semantic_transaction_fk() -> None:
    table = TraceStep.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "semantic_transaction_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "semantic_transactions"
    assert table.columns["semantic_transaction_id"].nullable is False


def test_trace_step_required_scalar_fields() -> None:
    table = TraceStep.__table__
    required_fields = {"step_number", "step_type", "created_at"}
    for field in required_fields:
        assert table.columns[field].nullable is False


def test_trace_step_extension_columns_are_nullable() -> None:
    table = TraceStep.__table__
    for column_name in (
        "layer",
        "status",
        "input_summary",
        "output_summary",
        "duration_ms",
    ):
        assert table.columns[column_name].nullable is True


def test_semantic_transaction_extension_columns() -> None:
    table = SemanticTransaction.__table__
    assert table.columns["status"].nullable is False
    assert table.columns["initiated_by"].nullable is True
    assert table.columns["participating_assets"].nullable is True


def test_semantic_transaction_trx_main_columns_are_nullable() -> None:
    table = SemanticTransaction.__table__
    for column_name in (
        "question_text",
        "answer_text",
        "started_at",
        "completed_at",
        "total_duration_ms",
        "mode",
    ):
        assert table.columns[column_name].nullable is True
