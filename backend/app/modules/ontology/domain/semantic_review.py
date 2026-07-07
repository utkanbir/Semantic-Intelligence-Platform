"""Domain models for advisory LLM semantic review findings.

The semantic review is an ADVISORY step that runs after deterministic
validation. Its findings never mutate the ``ontology_definition``; users may
accept or ignore individual findings, and those decisions are recorded for
lineage only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

SemanticFindingKind = Literal["suggestion", "warning", "improvement"]
SuggestionDecision = Literal["accepted", "ignored"]

_VALID_KINDS: frozenset[str] = frozenset({"suggestion", "warning", "improvement"})
_VALID_DECISIONS: frozenset[str] = frozenset({"accepted", "ignored"})


@dataclass(slots=True)
class SemanticReviewFinding:
    """A single advisory finding produced by the LLM semantic review."""

    id: str
    kind: SemanticFindingKind
    title: str
    detail: str
    target: str | None = None
    decision: SuggestionDecision | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "detail": self.detail,
            "target": self.target,
            "decision": self.decision,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> SemanticReviewFinding | None:
        finding_id = payload.get("id")
        title = payload.get("title")
        detail = payload.get("detail")
        if not isinstance(finding_id, str) or not finding_id.strip():
            return None
        if not isinstance(title, str) or not title.strip():
            return None
        kind = payload.get("kind")
        normalized_kind: SemanticFindingKind = (
            kind if kind in _VALID_KINDS else "suggestion"
        )
        decision = payload.get("decision")
        normalized_decision: SuggestionDecision | None = (
            decision if decision in _VALID_DECISIONS else None
        )
        target = payload.get("target")
        return cls(
            id=finding_id,
            kind=normalized_kind,
            title=title,
            detail=str(detail) if isinstance(detail, str) else "",
            target=str(target) if isinstance(target, str) and target.strip() else None,
            decision=normalized_decision,
        )


@dataclass(slots=True)
class SemanticReviewResult:
    """Structured advisory output of the LLM semantic review.

    ``available`` is ``False`` when the LLM port is disabled or errored, in
    which case the review degrades gracefully to a deterministic-only report.
    """

    available: bool
    reviewed_at: datetime
    review_id: UUID
    model: str | None = None
    summary: str | None = None
    findings: list[SemanticReviewFinding] = field(default_factory=list)

    @property
    def suggestion_count(self) -> int:
        return sum(1 for finding in self.findings if finding.kind == "suggestion")

    @property
    def warning_count(self) -> int:
        return sum(1 for finding in self.findings if finding.kind == "warning")

    @property
    def improvement_count(self) -> int:
        return sum(1 for finding in self.findings if finding.kind == "improvement")

    def find(self, finding_id: str) -> SemanticReviewFinding | None:
        for finding in self.findings:
            if finding.id == finding_id:
                return finding
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "reviewed_at": self.reviewed_at.isoformat(),
            "review_id": str(self.review_id),
            "model": self.model,
            "summary": self.summary,
            "findings": [finding.to_dict() for finding in self.findings],
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> SemanticReviewResult | None:
        if not payload:
            return None
        try:
            review_id = UUID(str(payload["review_id"]))
            reviewed_at = datetime.fromisoformat(str(payload["reviewed_at"]))
        except (KeyError, TypeError, ValueError):
            return None

        findings: list[SemanticReviewFinding] = []
        for item in payload.get("findings", []):
            if not isinstance(item, dict):
                continue
            finding = SemanticReviewFinding.from_dict(item)
            if finding is not None:
                findings.append(finding)

        model = payload.get("model")
        summary = payload.get("summary")
        return cls(
            available=bool(payload.get("available")),
            reviewed_at=reviewed_at,
            review_id=review_id,
            model=str(model) if isinstance(model, str) else None,
            summary=str(summary) if isinstance(summary, str) else None,
            findings=findings,
        )


def read_stored_semantic_review(
    ontology_definition: dict[str, Any],
) -> SemanticReviewResult | None:
    """Return the persisted semantic review snapshot, if any."""
    metadata = ontology_definition.get("metadata")
    if not isinstance(metadata, dict):
        return None
    review = metadata.get("semantic_review")
    if not isinstance(review, dict):
        return None
    return SemanticReviewResult.from_dict(review)


def attach_semantic_review(
    ontology_definition: dict[str, Any], review: SemanticReviewResult
) -> dict[str, Any]:
    """Return a copy of the definition with the semantic review snapshot stored."""
    definition = dict(ontology_definition)
    metadata = dict(definition.get("metadata", {}))
    metadata["semantic_review"] = review.to_dict()
    definition["metadata"] = metadata
    return definition
