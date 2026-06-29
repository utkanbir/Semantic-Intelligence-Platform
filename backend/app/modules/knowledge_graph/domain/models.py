"""Domain models for the knowledge_graph module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.knowledge_graph.domain.enums import KnowledgeGraphRegistryStatus


@dataclass(slots=True)
class KnowledgeGraphRegistry:
    """Knowledge graph registry aggregate root."""

    id: UUID
    application_id: UUID
    status: KnowledgeGraphRegistryStatus
    title: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    graph_metadata: dict[str, Any]
    bound_ontology_ids: list[str]
    description: str | None = None
    populated_at: datetime | None = None
    graph_updated_at: datetime | None = None
    archived_at: datetime | None = None
