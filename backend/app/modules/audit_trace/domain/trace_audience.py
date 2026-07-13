"""Trace audience classification for audit_trace read surfaces."""

from __future__ import annotations

from enum import StrEnum


class TraceAudience(StrEnum):
    """Audience classification for persisted trace records."""

    SEMANTIC_LINEAGE = "semantic_lineage"
    OPERATIONAL_AUDIT = "operational_audit"
    PLATFORM_PROVISIONING = "platform_provisioning"


SEMANTIC_LINEAGE_TRANSACTION_TYPES: frozenset[str] = frozenset(
    {
        "ontology.created",
        "ontology.imported",
        "ontology.generated",
        "ontology.updated",
        "ontology.status_changed",
        "ontology.version_forked",
        "ontology.published",
        "ontology.validation_run",
        "ontology.suggestion_reviewed",
        "ontology.connector_selected",
        "ontology.materialized",
        "ontology.question_answered",
    }
)

OPERATIONAL_AUDIT_TRANSACTION_TYPES: frozenset[str] = frozenset(
    {
        "adapter.registered",
        "connector.provisioned",
        "knowledge_graph.created",
        "product.created",
        "asset.created",
        "blueprint.created",
        "discovery.session.created",
        "agent.created",
        "agent.run.started",
        "policy.created",
    }
)

PLATFORM_PROVISIONING_TRANSACTION_TYPES: frozenset[str] = frozenset(
    {
        "ApplicationWorkspaceProvisioned",
    }
)


def resolve_trace_audience(transaction_type: str) -> TraceAudience:
    """Return the trace audience for a persisted transaction type."""

    if transaction_type in SEMANTIC_LINEAGE_TRANSACTION_TYPES:
        return TraceAudience.SEMANTIC_LINEAGE
    if transaction_type in OPERATIONAL_AUDIT_TRANSACTION_TYPES:
        return TraceAudience.OPERATIONAL_AUDIT
    if transaction_type in PLATFORM_PROVISIONING_TRANSACTION_TYPES:
        return TraceAudience.PLATFORM_PROVISIONING
    return TraceAudience.OPERATIONAL_AUDIT
