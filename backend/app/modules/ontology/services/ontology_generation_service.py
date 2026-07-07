"""Generate-from-Sources extraction service (S34-07).

Ingests MVP source inputs (file upload, pasted text, existing application
knowledge source), asks the LLM (only through :class:`LLMPort`, R-018) to
propose candidate classes/properties/relationships with source evidence
snippets, and returns a structured :class:`ExtractionResult`. Degrades
gracefully to an empty-candidate result when the LLM is unavailable so the
caller can still create an editable draft instead of crashing.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.modules.ontology.domain.extraction import (
    CandidateEvidence,
    ClassCandidate,
    ExtractionResult,
    ExtractionSource,
    PropertyCandidate,
    RelationshipCandidate,
)
from app.shared.ports.llm import LLMPort

# "ontology extraction" is the marker the deterministic stub keys on to return
# extraction-shaped JSON instead of the semantic-review shape.
_SYSTEM_PROMPT = (
    "You are an ontology extraction assistant. You perform ontology extraction "
    "from unstructured sources and propose CANDIDATE concepts only; you never "
    "assert a final ontology and you never claim validation passed. From the "
    "provided sources, identify candidate classes (concepts), data properties "
    "(attributes with a datatype), and relationships (object properties linking "
    "two classes). For every candidate include a short source evidence snippet "
    "quoted or paraphrased from the sources when available. "
    "Respond with a single JSON object and nothing else, using this schema: "
    '{"summary": string, '
    '"classes": [{"name": string, "label": string|null, "description": '
    'string|null, "evidence": [{"snippet": string, "source_ref": string|null}]}], '
    '"properties": [{"name": string, "label": string|null, "domain": string|null, '
    '"datatype": string|null, "description": string|null, "evidence": [...]}], '
    '"relationships": [{"name": string, "label": string|null, "domain": string|null, '
    '"range": string|null, "description": string|null, "evidence": [...]}]}. '
    "Keep candidates concise and grounded in the sources."
)

_MAX_CANDIDATES_PER_KIND = 100
_MAX_EVIDENCE_PER_CANDIDATE = 5
_MAX_SOURCE_CHARS = 12000


class OntologyGenerationService:
    """Builds candidate ontology drafts from sources via the LLM port."""

    def __init__(self, llm_port: LLMPort | None = None, *, model: str | None = None) -> None:
        self._llm_port = llm_port
        self._model = model

    def extract(
        self,
        sources: list[ExtractionSource],
        *,
        title: str | None = None,
        description: str | None = None,
    ) -> ExtractionResult:
        now = datetime.now(UTC)
        extraction_id = uuid4()

        if self._llm_port is None:
            return ExtractionResult(
                available=False,
                extracted_at=now,
                extraction_id=extraction_id,
                model=self._model,
                sources=sources,
            )

        user_prompt = self._build_prompt(sources, title=title, description=description)
        try:
            raw = self._llm_port.review_text(
                system_prompt=_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
        except Exception:  # noqa: BLE001 - advisory only, degrade gracefully
            return ExtractionResult(
                available=False,
                extracted_at=now,
                extraction_id=extraction_id,
                model=self._model,
                sources=sources,
            )

        summary, classes, properties, relationships = self._parse_response(raw)
        return ExtractionResult(
            available=True,
            extracted_at=now,
            extraction_id=extraction_id,
            model=self._model,
            summary=summary,
            classes=classes,
            properties=properties,
            relationships=relationships,
            sources=sources,
        )

    def _build_prompt(
        self,
        sources: list[ExtractionSource],
        *,
        title: str | None,
        description: str | None,
    ) -> str:
        lines = [
            f"Target ontology title: {title or 'Untitled'}",
            f"Application purpose / description: {description or 'None'}",
            f"Source count: {len(sources)}",
            "",
            "Sources:",
        ]
        for index, source in enumerate(sources, start=1):
            label = source.name or source.reference_id or f"source-{index}"
            content = source.content.strip()
            if len(content) > _MAX_SOURCE_CHARS:
                content = content[:_MAX_SOURCE_CHARS] + "…[truncated]"
            lines.append(f"--- Source {index} ({source.kind}: {label}) ---")
            lines.append(content)
        return "\n".join(lines)

    def _parse_response(
        self, raw: str
    ) -> tuple[
        str | None,
        list[ClassCandidate],
        list[PropertyCandidate],
        list[RelationshipCandidate],
    ]:
        payload = _extract_json_object(raw)
        if payload is None:
            summary = raw.strip() if raw and raw.strip() else None
            return summary, [], [], []

        summary = payload.get("summary")
        summary_text = str(summary).strip() if isinstance(summary, str) else None

        classes = self._parse_classes(payload.get("classes"))
        properties = self._parse_properties(payload.get("properties"))
        relationships = self._parse_relationships(payload.get("relationships"))
        return summary_text, classes, properties, relationships

    def _parse_classes(self, raw: Any) -> list[ClassCandidate]:
        candidates: list[ClassCandidate] = []
        for item in _iter_dicts(raw):
            name = _clean_name(item.get("name"))
            if name is None:
                continue
            candidates.append(
                ClassCandidate(
                    name=name,
                    label=_clean_text(item.get("label")),
                    description=_clean_text(item.get("description")),
                    evidence=_parse_evidence(item.get("evidence")),
                )
            )
            if len(candidates) >= _MAX_CANDIDATES_PER_KIND:
                break
        return candidates

    def _parse_properties(self, raw: Any) -> list[PropertyCandidate]:
        candidates: list[PropertyCandidate] = []
        for item in _iter_dicts(raw):
            name = _clean_name(item.get("name"))
            if name is None:
                continue
            candidates.append(
                PropertyCandidate(
                    name=name,
                    label=_clean_text(item.get("label")),
                    domain=_clean_text(item.get("domain")),
                    datatype=_clean_text(item.get("datatype")),
                    description=_clean_text(item.get("description")),
                    evidence=_parse_evidence(item.get("evidence")),
                )
            )
            if len(candidates) >= _MAX_CANDIDATES_PER_KIND:
                break
        return candidates

    def _parse_relationships(self, raw: Any) -> list[RelationshipCandidate]:
        candidates: list[RelationshipCandidate] = []
        for item in _iter_dicts(raw):
            name = _clean_name(item.get("name"))
            if name is None:
                continue
            candidates.append(
                RelationshipCandidate(
                    name=name,
                    label=_clean_text(item.get("label")),
                    domain=_clean_text(item.get("domain")),
                    range=_clean_text(item.get("range")),
                    description=_clean_text(item.get("description")),
                    evidence=_parse_evidence(item.get("evidence")),
                )
            )
            if len(candidates) >= _MAX_CANDIDATES_PER_KIND:
                break
        return candidates


def _iter_dicts(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, dict)]


def _parse_evidence(raw: Any) -> list[CandidateEvidence]:
    evidence: list[CandidateEvidence] = []
    for item in _iter_dicts(raw):
        parsed = CandidateEvidence.from_dict(item)
        if parsed is not None:
            evidence.append(parsed)
        if len(evidence) >= _MAX_EVIDENCE_PER_CANDIDATE:
            break
    return evidence


def _clean_name(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _clean_text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    if not raw or not raw.strip():
        return None
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
