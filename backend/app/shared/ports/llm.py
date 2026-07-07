"""LLM port protocol (R-018)."""

from __future__ import annotations

from typing import Protocol


class LLMPort(Protocol):
    """Abstraction for large language model provider access."""

    def ping(self) -> dict[str, str]:
        """Return health check result."""

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        """Return advisory text for a structured review prompt."""
