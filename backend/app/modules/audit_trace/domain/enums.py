"""Domain enumerations for the audit_trace module."""

from enum import StrEnum


class TraceLayer(StrEnum):
    """Semantic trace layering for multi-step audit flows (S38-01)."""

    EXPERIENCE = "ExperienceLayer"
    SEMANTIC = "SemanticLayer"
    KNOWLEDGE = "KnowledgeLayer"
    OPERATIONAL = "OperationalLayer"


class TraceStepStatus(StrEnum):
    """Lifecycle status for an individual trace step."""

    RUNNING = "Running"
    COMPLETED = "Completed"
    FAILED = "Failed"


class SemanticTransactionStatus(StrEnum):
    """Lifecycle status for a semantic transaction."""

    RUNNING = "Running"
    COMPLETED = "Completed"
    FAILED = "Failed"


class SemanticTransactionMode(StrEnum):
    """Execution mode for a semantic transaction (ADR-002 trx_main)."""

    RICH = "Rich"
    BARE = "Bare"
