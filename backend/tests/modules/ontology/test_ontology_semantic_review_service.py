"""Unit tests for the advisory LLM semantic review service."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import uuid4

from app.modules.ontology.domain.validation import (
    OntologyValidationReport,
    ValidationFinding,
)
from app.modules.ontology.services.ontology_semantic_review_service import (
    OntologySemanticReviewService,
)


def _report(*, passed: bool = True) -> OntologyValidationReport:
    findings = [ValidationFinding(level="info", code="stats", message="1 class")]
    if not passed:
        findings.append(
            ValidationFinding(level="error", code="parse_failed", message="broken")
        )
    return OntologyValidationReport(
        passed=passed,
        error_count=0 if passed else 1,
        warning_count=0,
        findings=findings,
        stats={"class_count": 1},
        run_at=datetime.now(UTC),
        run_id=uuid4(),
    )


class _JsonLLM:
    """Fake LLM port returning structured JSON findings."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "fake"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        self.calls.append((system_prompt, user_prompt))
        return json.dumps(
            {
                "summary": "Advisory review.",
                "findings": [
                    {
                        "kind": "suggestion",
                        "title": "Rename Vendor",
                        "detail": "Consider a clearer name.",
                        "target": "Vendor",
                    },
                    {
                        "kind": "warning",
                        "title": "Missing labels",
                        "detail": "Add rdfs:label to classes.",
                    },
                    {
                        "kind": "improvement",
                        "title": "Document namespace",
                        "detail": "Describe the base IRI purpose.",
                    },
                ],
            }
        )


class _ProseLLM:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "prose"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        return "This ontology looks reasonable but add labels."


class _ExplodingLLM:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "boom"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        raise RuntimeError("provider unavailable")


def test_review_parses_structured_findings() -> None:
    service = OntologySemanticReviewService(_JsonLLM(), model="stub-1")
    result = service.review(_report(), title="Vendor", description="Vendors")

    assert result.available is True
    assert result.model == "stub-1"
    assert result.summary == "Advisory review."
    assert len(result.findings) == 3
    assert result.suggestion_count == 1
    assert result.warning_count == 1
    assert result.improvement_count == 1
    assert result.findings[0].id == "finding-1"
    assert result.findings[0].target == "Vendor"
    assert all(finding.decision is None for finding in result.findings)


def test_review_degrades_when_llm_absent() -> None:
    service = OntologySemanticReviewService(None)
    result = service.review(_report())

    assert result.available is False
    assert result.findings == []
    assert result.summary is None


def test_review_degrades_on_llm_error() -> None:
    service = OntologySemanticReviewService(_ExplodingLLM())
    result = service.review(_report(passed=False))

    assert result.available is False
    assert result.findings == []


def test_review_keeps_prose_as_summary_without_findings() -> None:
    service = OntologySemanticReviewService(_ProseLLM())
    result = service.review(_report())

    assert result.available is True
    assert result.findings == []
    assert result.summary == "This ontology looks reasonable but add labels."


def test_review_findings_round_trip_through_dict() -> None:
    service = OntologySemanticReviewService(_JsonLLM())
    result = service.review(_report())

    from app.modules.ontology.domain.semantic_review import SemanticReviewResult

    restored = SemanticReviewResult.from_dict(result.to_dict())
    assert restored is not None
    assert len(restored.findings) == 3
    assert restored.summary == result.summary
