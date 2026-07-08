"""Web content port protocol (R-018)."""

from __future__ import annotations

from typing import Protocol

DEFAULT_WEB_CONTENT_MAX_BYTES = 1_048_576


class WebContentPort(Protocol):
    """Abstraction for fetching text content from remote URLs."""

    def fetch_text(
        self, *, url: str, max_bytes: int | None = None
    ) -> str:
        """Fetch and return textual content from the given URL."""
