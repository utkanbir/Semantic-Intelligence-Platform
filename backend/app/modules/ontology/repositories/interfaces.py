"""Repository interfaces for the ontology module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.ontology.domain.models import OntologyDefinition


class OntologyDefinitionRepository(Protocol):
    """Persistence contract for OntologyDefinition aggregate operations."""

    def create(self, ontology: OntologyDefinition) -> OntologyDefinition:
        """Persist a new ontology definition."""

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[OntologyDefinition]:
        """Return ontology definitions for an application."""

    def get(self, ontology_id: UUID) -> OntologyDefinition | None:
        """Return one ontology definition by id, if present."""

    def update(self, ontology: OntologyDefinition) -> OntologyDefinition | None:
        """Persist modifications for an existing ontology definition."""
