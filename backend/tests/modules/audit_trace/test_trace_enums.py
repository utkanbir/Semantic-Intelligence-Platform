"""Tests for audit_trace trace layer and status enums (S38-01, S39-02)."""

from app.modules.audit_trace.domain.enums import (
    SemanticTransactionMode,
    SemanticTransactionStatus,
    TraceLayer,
    TraceStepStatus,
)
from app.modules.audit_trace.repositories.sqlalchemy_repository import _parse_trace_layer


def test_trace_layer_values() -> None:
    assert TraceLayer.EXPERIENCE.value == "ExperienceLayer"
    assert TraceLayer.SEMANTIC.value == "SemanticLayer"
    assert TraceLayer.ONTOLOGY.value == "OntologyLayer"
    assert TraceLayer.KNOWLEDGE_GRAPH.value == "KnowledgeGraphLayer"
    assert TraceLayer.INFORMATION.value == "InformationLayer"
    assert TraceLayer.DATA.value == "DataLayer"
    assert TraceLayer.KNOWLEDGE.value == "KnowledgeLayer"
    assert TraceLayer.OPERATIONAL.value == "OperationalLayer"


def test_trace_layer_has_eight_members() -> None:
    assert len(TraceLayer) == 8


def test_parse_trace_layer_accepts_legacy_and_new_knowledge_layers() -> None:
    assert _parse_trace_layer("KnowledgeLayer") is TraceLayer.KNOWLEDGE
    assert _parse_trace_layer("KnowledgeGraphLayer") is TraceLayer.KNOWLEDGE_GRAPH
    assert _parse_trace_layer(None) is None


def test_trace_step_status_values() -> None:
    assert TraceStepStatus.RUNNING.value == "Running"
    assert TraceStepStatus.COMPLETED.value == "Completed"
    assert TraceStepStatus.FAILED.value == "Failed"


def test_semantic_transaction_status_values() -> None:
    assert SemanticTransactionStatus.RUNNING.value == "Running"
    assert SemanticTransactionStatus.COMPLETED.value == "Completed"
    assert SemanticTransactionStatus.FAILED.value == "Failed"


def test_semantic_transaction_mode_values() -> None:
    assert SemanticTransactionMode.RICH.value == "Rich"
    assert SemanticTransactionMode.BARE.value == "Bare"
