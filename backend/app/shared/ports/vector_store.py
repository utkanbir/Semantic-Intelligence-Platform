"""VectorStore port protocol (R-018)."""

from __future__ import annotations

from typing import Protocol


class VectorStorePort(Protocol):
    """Abstraction for vector store access."""

    def ping(self) -> dict[str, str]:
        """Return health check result."""
