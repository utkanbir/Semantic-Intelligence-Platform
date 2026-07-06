"""Deterministic LLM stub for CI and local development."""

from __future__ import annotations


class StubLLMAdapter:
    """Returns predictable advisory text without external calls."""

    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "stub"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        del system_prompt
        if "error" in user_prompt.lower():
            return (
                "Advisory: resolve structural errors before publishing. "
                "Consider adding labels and tightening domain/range references."
            )
        return (
            "Advisory: ontology structure looks usable for an initial semantic layer. "
            "Review naming consistency and add human-readable labels where missing."
        )
