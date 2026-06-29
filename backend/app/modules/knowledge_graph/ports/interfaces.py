"""Port interfaces for the knowledge_graph module."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID


class TraceRecorder(Protocol):
    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        """Persist one semantic transaction record."""


class PublishedOntologyReader(Protocol):
    def get_ontology_status(self, ontology_id: UUID) -> str | None:
        """Return ontology status if found; None if missing."""

    def get_application_id(self, ontology_id: UUID) -> UUID | None:
        """Return owning application id if ontology exists."""
