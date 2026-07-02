"""Repository interfaces for the semantic_connectors module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.semantic_connectors.domain.enums import SemanticConnectorType
from app.modules.semantic_connectors.domain.models import SemanticConnector


class SemanticConnectorRepository(Protocol):
    """Persistence contract for SemanticConnector operations."""

    def create(self, connector: SemanticConnector) -> SemanticConnector:
        """Persist a new semantic connector."""

    def get(self, connector_id: UUID) -> SemanticConnector | None:
        """Return one semantic connector by id."""

    def get_by_key(self, connector_key: str) -> SemanticConnector | None:
        """Return one semantic connector by key."""

    def list_all(
        self,
        *,
        connector_type: SemanticConnectorType | None = None,
        active_only: bool = False,
    ) -> Sequence[SemanticConnector]:
        """Return semantic connectors with optional filters."""
