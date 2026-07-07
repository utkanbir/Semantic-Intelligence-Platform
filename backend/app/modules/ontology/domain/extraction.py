"""Domain models for the Generate-from-Sources extraction pipeline (S34-07).

The extraction pipeline ingests MVP source inputs (file upload, pasted text,
existing application knowledge source), asks the LLM (via :class:`LLMPort`,
R-018) to propose candidate classes, properties, and relationships, and
produces an **editable Ontology Draft**. Candidates are ADVISORY: they never
auto-materialize and the draft is created draft-only (no graph-store write).

Candidates carry source evidence snippets where the LLM provides them so the
review/edit UI (separate Frontend task) can show provenance per candidate.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

ExtractionSourceKind = Literal["file", "paste", "knowledge_source"]

_VALID_SOURCE_KINDS: frozenset[str] = frozenset({"file", "paste", "knowledge_source"})

# MVP scope guard: URL fetch and CSV/Excel parsing are deferred to Sprint 35.
# The extraction pipeline only accepts text-bearing sources supplied inline so
# it never crosses a module boundary with a new ingestion port.


@dataclass(slots=True)
class ExtractionSource:
    """A single text-bearing source supplied for extraction.

    ``content`` is the raw text extracted client-side (uploaded file text,
    pasted text, or the text of an existing application knowledge source).
    ``reference_id`` is an opaque lineage handle (e.g. knowledge source id or
    original filename) recorded for trace/provenance only.
    """

    kind: ExtractionSourceKind
    content: str
    name: str | None = None
    reference_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "name": self.name,
            "reference_id": self.reference_id,
            "content_length": len(self.content),
        }


@dataclass(slots=True)
class CandidateEvidence:
    """A source evidence snippet supporting a candidate."""

    snippet: str
    source_ref: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {"snippet": self.snippet, "source_ref": self.source_ref}

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> CandidateEvidence | None:
        snippet = payload.get("snippet")
        if not isinstance(snippet, str) or not snippet.strip():
            return None
        source_ref = payload.get("source_ref")
        return cls(
            snippet=snippet.strip(),
            source_ref=(
                source_ref.strip()
                if isinstance(source_ref, str) and source_ref.strip()
                else None
            ),
        )


@dataclass(slots=True)
class ClassCandidate:
    """A candidate ontology class proposed by extraction."""

    name: str
    label: str | None = None
    description: str | None = None
    evidence: list[CandidateEvidence] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "evidence": [item.to_dict() for item in self.evidence],
        }


@dataclass(slots=True)
class PropertyCandidate:
    """A candidate data property proposed by extraction."""

    name: str
    label: str | None = None
    domain: str | None = None
    datatype: str | None = None
    description: str | None = None
    evidence: list[CandidateEvidence] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "domain": self.domain,
            "datatype": self.datatype,
            "description": self.description,
            "evidence": [item.to_dict() for item in self.evidence],
        }


@dataclass(slots=True)
class RelationshipCandidate:
    """A candidate object relationship proposed by extraction."""

    name: str
    label: str | None = None
    domain: str | None = None
    range: str | None = None
    description: str | None = None
    evidence: list[CandidateEvidence] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "domain": self.domain,
            "range": self.range,
            "description": self.description,
            "evidence": [item.to_dict() for item in self.evidence],
        }


@dataclass(slots=True)
class ExtractionResult:
    """Structured advisory output of the LLM extraction pass.

    ``available`` is ``False`` when the LLM port is disabled or errored, in
    which case extraction degrades gracefully to an empty-candidate result and
    the caller still produces an editable (empty) draft rather than crashing.
    """

    available: bool
    extracted_at: datetime
    extraction_id: UUID
    model: str | None = None
    summary: str | None = None
    classes: list[ClassCandidate] = field(default_factory=list)
    properties: list[PropertyCandidate] = field(default_factory=list)
    relationships: list[RelationshipCandidate] = field(default_factory=list)
    sources: list[ExtractionSource] = field(default_factory=list)

    @property
    def class_count(self) -> int:
        return len(self.classes)

    @property
    def property_count(self) -> int:
        return len(self.properties)

    @property
    def relationship_count(self) -> int:
        return len(self.relationships)

    @property
    def candidate_count(self) -> int:
        return self.class_count + self.property_count + self.relationship_count

    def to_dict(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "extracted_at": self.extracted_at.isoformat(),
            "extraction_id": str(self.extraction_id),
            "model": self.model,
            "summary": self.summary,
            "classes": [item.to_dict() for item in self.classes],
            "properties": [item.to_dict() for item in self.properties],
            "relationships": [item.to_dict() for item in self.relationships],
            "sources": [item.to_dict() for item in self.sources],
        }
