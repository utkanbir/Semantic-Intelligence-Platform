"""Tests for audit_trace domain + ORM models."""

from app.modules.audit_trace.repositories.orm_models import TraceStep


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
