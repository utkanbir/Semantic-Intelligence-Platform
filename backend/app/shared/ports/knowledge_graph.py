"""KnowledgeGraph port protocol (R-018)."""

from __future__ import annotations

from typing import Protocol


class KnowledgeGraphPort(Protocol):
    """Abstraction for knowledge graph store access."""

    def ping(self) -> dict[str, str]:
        """Return health check result."""

    def import_data(
        self,
        *,
        dataset: str,
        content: str,
        content_type: str,
        graph: str | None = None,
    ) -> dict[str, str]:
        """Import RDF content into a named dataset (optional named graph)."""

    def export_data(
        self,
        *,
        dataset: str,
        accept_format: str = "text/turtle",
        graph: str | None = None,
    ) -> str:
        """Export RDF content from a named dataset (optional named graph)."""

    def delete_graph(self, *, dataset: str, graph: str) -> None:
        """Remove all triples in a named graph."""

    def delete_default_graph_content(
        self, *, dataset: str, content: str, content_type: str
    ) -> None:
        """Remove triples from the default graph that match parsed RDF content."""
