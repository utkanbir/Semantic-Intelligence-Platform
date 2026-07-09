"""Unit tests for trace audience classification."""

from __future__ import annotations

import pytest

from app.modules.audit_trace.domain.trace_audience import (
    TraceAudience,
    resolve_trace_audience,
)


@pytest.mark.parametrize(
    ("transaction_type", "expected"),
    [
        ("ontology.created", TraceAudience.SEMANTIC_LINEAGE),
        ("ontology.imported", TraceAudience.SEMANTIC_LINEAGE),
        ("ontology.validation_run", TraceAudience.SEMANTIC_LINEAGE),
        ("ontology.question_answered", TraceAudience.SEMANTIC_LINEAGE),
        ("product.created", TraceAudience.OPERATIONAL_AUDIT),
        ("agent.run.started", TraceAudience.OPERATIONAL_AUDIT),
        ("adapter.registered", TraceAudience.OPERATIONAL_AUDIT),
        ("connector.provisioned", TraceAudience.OPERATIONAL_AUDIT),
        ("ApplicationWorkspaceProvisioned", TraceAudience.PLATFORM_PROVISIONING),
        ("unknown.event", TraceAudience.OPERATIONAL_AUDIT),
    ],
)
def test_resolve_trace_audience(transaction_type: str, expected: TraceAudience) -> None:
    assert resolve_trace_audience(transaction_type) is expected
