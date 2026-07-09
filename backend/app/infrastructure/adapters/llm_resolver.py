"""Resolve LLM port implementations from application settings.

When ``llm_provider`` is ``stub`` (default), the port returns deterministic placeholder
responses. User-facing copy uses **Advisory semantic review** — not a live LLM — until a
real provider adapter is wired here (see S36-06 / audit remediation).
"""

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
