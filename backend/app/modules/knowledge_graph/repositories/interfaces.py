"""Repository interfaces for the knowledge_graph module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.knowledge_graph.domain.models import KnowledgeGraphRegistry


class KnowledgeGraphRegistryRepository(Protocol):
    def create(self, registry: KnowledgeGraphRegistry) -> KnowledgeGraphRegistry:
        """Persist a new knowledge graph registry."""

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[KnowledgeGraphRegistry]:
        """Return registries for an application."""

    def get(self, registry_id: UUID) -> KnowledgeGraphRegistry | None:
        """Return one registry by id, if present."""

    def update(self, registry: KnowledgeGraphRegistry) -> KnowledgeGraphRegistry | None:
        """Persist modifications for an existing registry."""
