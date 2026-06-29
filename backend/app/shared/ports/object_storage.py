"""ObjectStorage port protocol (R-018)."""

from __future__ import annotations

from typing import Protocol


class ObjectStoragePort(Protocol):
    """Abstraction for object storage access."""

    def ping(self) -> dict[str, str]:
        """Return health check result."""
