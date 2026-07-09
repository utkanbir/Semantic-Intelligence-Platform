"""Deterministic LLM stub for CI and local development."""

from __future__ import annotations

import json


class StubLLMAdapter:
    """Returns predictable advisory text without external calls."""

    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "stub"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        if "ontology extraction" in system_prompt.lower():
            return self._structured_extraction(user_prompt)
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

    def _structured_extraction(self, user_prompt: str) -> str:
        snippet = self._first_snippet(user_prompt)
        return json.dumps(
            {
                "summary": (
                    "Candidate ontology extracted from sources; concepts are "
                    "advisory suggestions for review and do not materialize."
                ),
                "classes": [
                    {
                        "name": "Invoice",
                        "label": "Invoice",
                        "description": "A billing document issued to a customer.",
                        "evidence": [{"snippet": snippet, "source_ref": "source-1"}],
                    },
                    {
                        "name": "Vendor",
                        "label": "Vendor",
                        "description": "A supplier of goods or services.",
                        "evidence": [],
                    },
                ],
                "properties": [
                    {
                        "name": "invoiceAmount",
                        "label": "Invoice Amount",
                        "domain": "Invoice",
                        "datatype": "decimal",
                        "description": "Total monetary amount of the invoice.",
                        "evidence": [{"snippet": snippet, "source_ref": "source-1"}],
                    }
                ],
                "relationships": [
                    {
                        "name": "issuedBy",
                        "label": "Issued By",
                        "domain": "Invoice",
                        "range": "Vendor",
                        "description": "Links an invoice to the vendor that issued it.",
                        "evidence": [],
                    }
                ],
            }
        )

    @staticmethod
    def _first_snippet(user_prompt: str, *, limit: int = 160) -> str:
        for line in user_prompt.splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("---") and ":" not in stripped[:20]:
                return stripped[:limit]
        return "Source content provided for extraction."
