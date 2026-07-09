"""Unit tests for llm_resolver (S37-03)."""

from __future__ import annotations

import pytest

from app.core.config import get_settings
from app.infrastructure.adapters.llm_resolver import (
    UnsupportedLLMProviderError,
    resolve_llm_port,
)


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_resolve_stub_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SIP_LLM_ENABLED", "true")
    monkeypatch.setenv("SIP_LLM_PROVIDER", "stub")
    port = resolve_llm_port()
    assert port is not None
    assert port.ping()["provider"] == "stub"


def test_resolve_disabled_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SIP_LLM_ENABLED", "false")
    monkeypatch.setenv("SIP_LLM_PROVIDER", "stub")
    assert resolve_llm_port() is None


def test_unknown_provider_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SIP_LLM_ENABLED", "true")
    monkeypatch.setenv("SIP_LLM_PROVIDER", "openai")
    with pytest.raises(UnsupportedLLMProviderError, match="openai"):
        resolve_llm_port()
