"""Resolve LLM port implementations from application settings."""

from __future__ import annotations

from app.core.config import get_settings
from app.infrastructure.adapters.llm_stub import StubLLMAdapter
from app.shared.ports.llm import LLMPort


def resolve_llm_port() -> LLMPort | None:
    settings = get_settings()
    if not settings.llm_enabled:
        return None
    if settings.llm_provider == "stub":
        return StubLLMAdapter()
    return StubLLMAdapter()
