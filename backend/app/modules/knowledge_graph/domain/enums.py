"""Domain enumerations for the knowledge_graph module."""

from __future__ import annotations

from enum import StrEnum


class KnowledgeGraphRegistryStatus(StrEnum):
    """KnowledgeGraphRegistry lifecycle states (ARR-002)."""

    CREATED = "Created"
    POPULATED = "Populated"
    UPDATED = "Updated"
    ARCHIVED = "Archived"
