"""Advisory LLM semantic review for ontology validation runs.

Runs AFTER deterministic validation. Produces structured, advisory findings
(suggestions, warnings, improvement ideas) that never mutate the ontology
definition. Accesses the LLM only through the existing :class:`LLMPort`
abstraction (R-018) and degrades gracefully to a deterministic-only report
when the LLM is unavailable.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.modules.ontology.domain.semantic_review import (
    SemanticReviewFinding,
    SemanticReviewResult,
)
from app.modules.ontology.domain.validation import OntologyValidationReport
from app.shared.ports.llm import LLMPort

_SYSTEM_PROMPT = (
    "You are an ontology quality reviewer. You review OWL/RDF ontologies and "
    "return ADVISORY findings only. You never claim validation passed or "
    "failed and you never modify the ontology. Analyse naming consistency, "
    "missing or overlapping concepts, weak relationships, missing labels, "
    "domain/range clarity, and coherence with the stated purpose. "
    "Respond with a single JSON object and nothing else, using this schema: "
    '{"summary": string, "findings": [{"kind": '
    '"suggestion"|"warning"|"improvement", "title": string, '
    '"detail": string, "target": string|null}]}. '
    "Keep the findings concise and actionable."
)

_MAX_FINDINGS = 25


class OntologySemanticReviewService:
    """Builds advisory semantic review findings via the LLM port."""

    def __init__(self, llm_port: LLMPort | None = None, *, model: str | None = None) -> None:
        self._llm_port = llm_port
        self._model = model

    def review(
        self,
        report: OntologyValidationReport,
        *,
        title: str | None = None,
        description: str | None = None,
    ) -> SemanticReviewResult:
        now = datetime.now(UTC)
        review_id = uuid4()

        if self._llm_port is None:
            return SemanticReviewResult(
                available=False,
                reviewed_at=now,
                review_id=review_id,
            )

        user_prompt = self._build_prompt(report, title=title, description=description)
        try:
            raw = self._llm_port.review_text(
                system_prompt=_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
        except Exception:  # noqa: BLE001 - advisory only, degrade gracefully
            return SemanticReviewResult(
                available=False,
                reviewed_at=now,
                review_id=review_id,
                model=self._model,
            )

        summary, findings = self._parse_response(raw)
        return SemanticReviewResult(
            available=True,
            reviewed_at=now,
            review_id=review_id,
            model=self._model,
            summary=summary,
            findings=findings,
        )

    def _build_prompt(
        self,
        report: OntologyValidationReport,
        *,
        title: str | None,
        description: str | None,
    ) -> str:
        lines = [
            f"Title: {title or 'Untitled'}",
            f"Description: {description or 'None'}",
            f"Deterministic validation passed: {report.passed}",
            f"Errors: {report.error_count}, Warnings: {report.warning_count}",
            f"Stats: {report.stats}",
        ]
        deterministic = [
            f"[{finding.level}] {finding.code}: {finding.message}"
            for finding in report.findings
            if finding.level != "info"
        ]
        if deterministic:
            lines.append("Deterministic findings:")
            lines.extend(deterministic)
        if report.inventory is not None:
            class_names = [item.local_name for item in report.inventory.classes]
            relation_names = [item.local_name for item in report.inventory.relations]
            lines.append(f"Classes: {', '.join(class_names) or 'none'}")
            lines.append(f"Relations: {', '.join(relation_names) or 'none'}")
        return "\n".join(lines)

    def _parse_response(
        self, raw: str
    ) -> tuple[str | None, list[SemanticReviewFinding]]:
        if not raw or not raw.strip():
            return None, []

        payload = _extract_json_object(raw)
        if payload is None:
            # LLM responded but not with structured JSON; keep prose as summary.
            return raw.strip(), []

        summary = payload.get("summary")
        summary_text = str(summary).strip() if isinstance(summary, str) else None

        findings: list[SemanticReviewFinding] = []
        raw_findings = payload.get("findings")
        if isinstance(raw_findings, list):
            for item in raw_findings:
                if not isinstance(item, dict):
                    continue
                finding = self._build_finding(item, index=len(findings))
                if finding is not None:
                    findings.append(finding)
                if len(findings) >= _MAX_FINDINGS:
                    break
        return summary_text, findings

    def _build_finding(
        self, item: dict[str, Any], *, index: int
    ) -> SemanticReviewFinding | None:
        title = item.get("title")
        if not isinstance(title, str) or not title.strip():
            return None
        provided_id = item.get("id")
        finding_id = (
            provided_id.strip()
            if isinstance(provided_id, str) and provided_id.strip()
            else f"finding-{index + 1}"
        )
        normalized = {
            "id": finding_id,
            "kind": item.get("kind"),
            "title": title,
            "detail": item.get("detail"),
            "target": item.get("target"),
        }
        return SemanticReviewFinding.from_dict(normalized)


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        parsed = _try_embedded_object(text)
    if isinstance(parsed, dict):
        return parsed
    return None


def _try_embedded_object(text: str) -> Any:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except (ValueError, TypeError):
        return None
