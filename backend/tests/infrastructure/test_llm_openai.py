"""Unit tests for OpenAILLMAdapter (S38-02)."""

from __future__ import annotations

import json

import httpx
import pytest

from app.infrastructure.adapters.llm_openai import OpenAILLMAdapter, OpenAILLMError


def test_ping_reports_provider_and_model() -> None:
    adapter = OpenAILLMAdapter(api_key="test-key", model="gpt-4o-mini")
    assert adapter.ping() == {
        "status": "ok",
        "provider": "openai",
        "model": "gpt-4o-mini",
    }


def test_review_text_posts_chat_completion_and_returns_content() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/chat/completions")
        assert request.headers["authorization"] == "Bearer test-key"
        body = json.loads(request.content.decode())
        assert body["model"] == "gpt-4o-mini"
        assert body["messages"][0]["role"] == "system"
        assert body["messages"][1]["content"] == "user question"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "model answer"}}]},
        )

    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport, base_url="https://api.openai.com/v1")
    adapter = OpenAILLMAdapter(
        api_key="test-key",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        client=client,
    )

    result = adapter.review_text(system_prompt="system", user_prompt="user question")
    assert result == "model answer"


def test_review_text_raises_on_http_error() -> None:
    transport = httpx.MockTransport(lambda _request: httpx.Response(500, text="boom"))
    client = httpx.Client(transport=transport, base_url="https://api.openai.com/v1")
    adapter = OpenAILLMAdapter(
        api_key="test-key",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        client=client,
    )

    with pytest.raises(OpenAILLMError, match="OpenAI request failed"):
        adapter.review_text(system_prompt="system", user_prompt="user")


def test_review_text_raises_on_malformed_response() -> None:
    transport = httpx.MockTransport(lambda _request: httpx.Response(200, json={"choices": []}))
    client = httpx.Client(transport=transport, base_url="https://api.openai.com/v1")
    adapter = OpenAILLMAdapter(
        api_key="test-key",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        client=client,
    )

    with pytest.raises(OpenAILLMError, match="missing message content"):
        adapter.review_text(system_prompt="system", user_prompt="user")
