"""Resolve LLM port implementations from application settings."""

from __future__ import annotations

from app.core.config import get_settings
from app.infrastructure.adapters.llm_openai import OpenAILLMAdapter
from app.infrastructure.adapters.llm_stub import StubLLMAdapter
from app.shared.ports.llm import LLMPort

SUPPORTED_LLM_PROVIDERS: frozenset[str] = frozenset({"stub", "openai"})


class UnsupportedLLMProviderError(RuntimeError):
    """Raised when ``llm_provider`` is not a wired adapter (S37-03)."""


def resolve_llm_port() -> LLMPort | None:
    settings = get_settings()
    if not settings.llm_enabled:
        return None

    provider = settings.llm_provider.strip().lower()
    if provider == "stub":
        return StubLLMAdapter()
    if provider == "openai":
        if not settings.llm_api_key:
            raise UnsupportedLLMProviderError(
                "Unsupported llm_provider 'openai' without SIP_LLM_API_KEY. "
                f"Supported providers: {sorted(SUPPORTED_LLM_PROVIDERS)}. "
                "Set SIP_LLM_API_KEY or use llm_provider='stub'."
            )
        return OpenAILLMAdapter(
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            base_url=settings.llm_api_base_url,
        )

    raise UnsupportedLLMProviderError(
        f"Unsupported llm_provider {settings.llm_provider!r}. "
        f"Supported providers: {sorted(SUPPORTED_LLM_PROVIDERS)}. "
        "Wire a real adapter before selecting another provider."
    )
