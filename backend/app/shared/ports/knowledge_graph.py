"""KnowledgeGraph port protocol (R-018)."""

from __future__ import annotations

from typing import Protocol


class KnowledgeGraphPort(Protocol):
    """Abstraction for knowledge graph store access."""

    def ping(self) -> dict[str, str]:
        """Return health check result."""

    def import_data(
        self, *, dataset: str, content: str, content_type: str
    ) -> dict[str, str]:
        """Import RDF content into a named dataset."""

    def export_data(
        self, *, dataset: str, accept_format: str = "text/turtle"
    ) -> str:
        """Export RDF content from a named dataset."""
