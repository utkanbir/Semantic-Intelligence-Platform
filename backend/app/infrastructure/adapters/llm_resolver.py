"""Resolve LLM port implementations from application settings."""

from __future__ import annotations

from app.core.config import get_settings
from app.infrastructure.adapters.llm_stub import StubLLMAdapter
from app.shared.ports.llm import LLMPort

SUPPORTED_LLM_PROVIDERS: frozenset[str] = frozenset({"stub"})


class UnsupportedLLMProviderError(RuntimeError):
    """Raised when ``llm_provider`` is not a wired adapter (S37-03)."""


def resolve_llm_port() -> LLMPort | None:
    settings = get_settings()
    if not settings.llm_enabled:
        return None

    provider = settings.llm_provider.strip().lower()
    if provider in SUPPORTED_LLM_PROVIDERS:
        return StubLLMAdapter()

    raise UnsupportedLLMProviderError(
        f"Unsupported llm_provider {settings.llm_provider!r}. "
        f"Supported providers: {sorted(SUPPORTED_LLM_PROVIDERS)}. "
        "Wire a real adapter before selecting another provider."
    )
