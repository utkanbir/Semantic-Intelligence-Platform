"""Tests for audit_trace trace layer and status enums (S38-01)."""

from app.modules.audit_trace.domain.enums import (
    SemanticTransactionStatus,
    TraceLayer,
    TraceStepStatus,
)


def test_trace_layer_values() -> None:
    assert TraceLayer.EXPERIENCE.value == "ExperienceLayer"
    assert TraceLayer.SEMANTIC.value == "SemanticLayer"
    assert TraceLayer.KNOWLEDGE.value == "KnowledgeLayer"
    assert TraceLayer.OPERATIONAL.value == "OperationalLayer"


def test_trace_step_status_values() -> None:
    assert TraceStepStatus.RUNNING.value == "Running"
    assert TraceStepStatus.COMPLETED.value == "Completed"
    assert TraceStepStatus.FAILED.value == "Failed"


def test_semantic_transaction_status_values() -> None:
    assert SemanticTransactionStatus.RUNNING.value == "Running"
    assert SemanticTransactionStatus.COMPLETED.value == "Completed"
    assert SemanticTransactionStatus.FAILED.value == "Failed"
