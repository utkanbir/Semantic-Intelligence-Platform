"""Domain enumerations for the audit_trace module."""

from enum import StrEnum


class TraceLayer(StrEnum):
    """Semantic trace layering for multi-step audit flows (S38-01, S39-02 / ADR-002)."""

    EXPERIENCE = "ExperienceLayer"
    SEMANTIC = "SemanticLayer"
    ONTOLOGY = "OntologyLayer"
    KNOWLEDGE_GRAPH = "KnowledgeGraphLayer"
    INFORMATION = "InformationLayer"
    DATA = "DataLayer"
    KNOWLEDGE = "KnowledgeLayer"  # legacy S38 rows; prefer KNOWLEDGE_GRAPH for new writes
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
