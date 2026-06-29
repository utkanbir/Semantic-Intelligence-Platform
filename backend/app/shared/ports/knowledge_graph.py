"""KnowledgeGraph port protocol (R-018)."""

from __future__ import annotations

from typing import Protocol


class KnowledgeGraphPort(Protocol):
    """Abstraction for knowledge graph store access."""

    def ping(self) -> dict[str, str]:
        """Return health check result."""
