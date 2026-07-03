"""Port interfaces for the ontology module."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from app.modules.adapters.domain.models import TechnologyAdapter
from app.shared.ports.knowledge_graph import KnowledgeGraphPort


class KnowledgeGraphPortResolver(Protocol):
    """Outbound port for resolving knowledge graph adapters from connectors."""

    def resolve(self, connector: TechnologyAdapter) -> KnowledgeGraphPort:
        """Return a knowledge graph port for the given connector."""


class OntologyTransactionRecorder(Protocol):
    """Outbound port for orchestrated ontology semantic transactions."""

    def record_orchestrated(
        self,
        *,
        transaction_type: str,
        resource_id: str,
        application_id: UUID,
        steps: list[tuple[str, str | None]],
    ) -> UUID | None:
        """Persist one semantic transaction with trace steps."""
