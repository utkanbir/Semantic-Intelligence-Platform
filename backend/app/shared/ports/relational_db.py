"""RelationalDB port protocol (R-018)."""

from __future__ import annotations

from typing import Protocol


class RelationalDBPort(Protocol):
    """Abstraction for relational database access."""

    def ping(self) -> dict[str, str]:
        """Return health check result."""
