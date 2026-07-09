"""OpenAI-compatible LLM adapter using httpx (S38-02)."""

from __future__ import annotations

from typing import Any

import httpx


class OpenAILLMError(RuntimeError):
    """Raised when the OpenAI-compatible API returns an error response."""


class OpenAILLMAdapter:
    """Calls an OpenAI-compatible chat completions API through httpx."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str = "https://api.openai.com/v1",
        timeout: float = 60.0,
        client: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._client = client

    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "openai", "model": self._model}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        response_data = self._post_json("/chat/completions", payload)
        try:
            return str(response_data["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError) as error:
            raise OpenAILLMError("OpenAI response missing message content") from error

    def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self._base_url}{path}"
        try:
            if self._client is not None:
                response = self._client.post(url, headers=headers, json=payload)
            else:
                with httpx.Client(timeout=self._timeout) as client:
                    response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise OpenAILLMError(f"OpenAI request failed: {error}") from error
        data = response.json()
        if not isinstance(data, dict):
            raise OpenAILLMError("OpenAI response was not a JSON object")
        return data
