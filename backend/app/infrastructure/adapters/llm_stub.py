"""Deterministic LLM stub for CI and local development."""

from __future__ import annotations

import json


class StubLLMAdapter:
    """Returns predictable advisory text without external calls."""

    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "stub"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        if "JSON object" in system_prompt:
            return self._structured_review(user_prompt)
        if "error" in user_prompt.lower():
            return (
                "Advisory: resolve structural errors before publishing. "
                "Consider adding labels and tightening domain/range references."
            )
        return (
            "Advisory: ontology structure looks usable for an initial semantic layer. "
            "Review naming consistency and add human-readable labels where missing."
        )

    def _structured_review(self, user_prompt: str) -> str:
        findings = [
            {
                "kind": "improvement",
                "title": "Add human-readable labels",
                "detail": (
                    "Ensure every class and property has an rdfs:label to improve "
                    "discoverability for downstream consumers."
                ),
                "target": None,
            },
            {
                "kind": "suggestion",
                "title": "Review naming consistency",
                "detail": (
                    "Use a consistent casing and vocabulary for class and property "
                    "local names across the ontology."
                ),
                "target": None,
            },
        ]
        if "warning" in user_prompt.lower() or "error" in user_prompt.lower():
            findings.append(
                {
                    "kind": "warning",
                    "title": "Tighten domain and range references",
                    "detail": (
                        "Some relationships have weak or missing domain/range "
                        "definitions; specify them to clarify semantics."
                    ),
                    "target": None,
                }
            )
        return json.dumps(
            {
                "summary": (
                    "Advisory semantic review completed; findings are suggestions "
                    "only and do not modify the ontology."
                ),
                "findings": findings,
            }
        )
