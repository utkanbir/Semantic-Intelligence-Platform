"""Port interfaces for the ontology module."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID


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
