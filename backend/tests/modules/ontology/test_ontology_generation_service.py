"""Unit tests for the Generate-from-Sources extraction service (S34-07)."""

from __future__ import annotations

import json

import pytest

from app.modules.ontology.domain.extraction import ExtractionSource
from app.modules.ontology.services.ontology_generation_service import (
    OntologyGenerationService,
)
from app.shared.web_content import WebContentFetchError


def _sources() -> list[ExtractionSource]:
    return [
        ExtractionSource(
            kind="paste",
            content="Invoices are issued by vendors and carry a total amount.",
            name="notes.txt",
        ),
        ExtractionSource(
            kind="knowledge_source",
            content="Each vendor supplies goods to the company.",
            reference_id="ks-42",
        ),
    ]


class _JsonLLM:
    """Fake LLM port returning structured extraction JSON."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "fake"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        self.calls.append((system_prompt, user_prompt))
        return json.dumps(
            {
                "summary": "Extracted candidates.",
                "classes": [
                    {
                        "name": "Invoice",
                        "label": "Invoice",
                        "description": "Billing document.",
                        "evidence": [
                            {"snippet": "Invoices are issued", "source_ref": "source-1"}
                        ],
                    },
                    {"name": "Vendor"},
                    {"label": "no-name-dropped"},
                ],
                "properties": [
                    {
                        "name": "amount",
                        "domain": "Invoice",
                        "datatype": "decimal",
                        "evidence": [{"snippet": "total amount"}],
                    }
                ],
                "relationships": [
                    {
                        "name": "issuedBy",
                        "domain": "Invoice",
                        "range": "Vendor",
                        "evidence": [],
                    }
                ],
            }
        )


class _ProseLLM:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "prose"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        return "I could not find structured candidates in these sources."


class _ExplodingLLM:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "provider": "boom"}

    def review_text(self, *, system_prompt: str, user_prompt: str) -> str:
        raise RuntimeError("provider unavailable")


class _StubWebContentPort:
    def __init__(self, *, content: str = "Fetched page text about vendors.") -> None:
        self._content = content
        self.calls: list[str] = []

    def fetch_text(self, *, url: str, max_bytes: int = 1_048_576) -> str:
        self.calls.append(url)
        return self._content


class _FailingWebContentPort:
    def fetch_text(self, *, url: str, max_bytes: int = 1_048_576) -> str:
        raise WebContentFetchError("upstream unavailable")


def test_resolve_sources_fetches_url_kind() -> None:
    web = _StubWebContentPort()
    service = OntologyGenerationService(_JsonLLM(), web_content_port=web)
    sources = [
        ExtractionSource(
            kind="url",
            content="",
            url="https://example.com/spec.html",
            name="spec.html",
        )
    ]

    resolved = service.resolve_sources(sources)

    assert web.calls == ["https://example.com/spec.html"]
    assert resolved[0].content == "Fetched page text about vendors."
    assert resolved[0].url == "https://example.com/spec.html"


def test_extract_includes_fetched_url_content_in_prompt() -> None:
    llm = _JsonLLM()
    web = _StubWebContentPort(content="Vendors issue invoices monthly.")
    service = OntologyGenerationService(llm, web_content_port=web)
    sources = [
        ExtractionSource(kind="url", content="", url="https://example.com/billing")
    ]

    service.extract(sources, title="Billing")

    _system, user_prompt = llm.calls[0]
    assert "Vendors issue invoices monthly." in user_prompt
    assert "url: https://example.com/billing" in user_prompt


def test_resolve_sources_raises_on_fetch_failure() -> None:
    service = OntologyGenerationService(web_content_port=_FailingWebContentPort())
    sources = [ExtractionSource(kind="url", content="", url="https://example.com/fail")]

    with pytest.raises(WebContentFetchError, match="upstream unavailable"):
        service.resolve_sources(sources)


def test_extract_parses_structured_candidates() -> None:
    llm = _JsonLLM()
    service = OntologyGenerationService(llm, model="stub-1")
    result = service.extract(_sources(), title="Billing", description="Billing domain")

    assert result.available is True
    assert result.model == "stub-1"
    assert result.summary == "Extracted candidates."
    # Third class entry has no name and is dropped.
    assert result.class_count == 2
    assert result.property_count == 1
    assert result.relationship_count == 1
    assert result.candidate_count == 4
    assert result.classes[0].name == "Invoice"
    assert result.classes[0].evidence[0].snippet == "Invoices are issued"
    assert result.classes[0].evidence[0].source_ref == "source-1"
    assert result.relationships[0].domain == "Invoice"
    assert result.relationships[0].range == "Vendor"
    # Sources are echoed back for lineage.
    assert len(result.sources) == 2


def test_extract_prompt_includes_source_content() -> None:
    llm = _JsonLLM()
    service = OntologyGenerationService(llm)
    service.extract(_sources(), title="Billing")

    _system, user_prompt = llm.calls[0]
    assert "Invoices are issued by vendors" in user_prompt
    assert "knowledge_source" in user_prompt


def test_extract_degrades_when_llm_absent() -> None:
    service = OntologyGenerationService(None)
    result = service.extract(_sources())

    assert result.available is False
    assert result.candidate_count == 0
    assert result.summary is None
    assert len(result.sources) == 2


def test_extract_degrades_on_llm_error() -> None:
    service = OntologyGenerationService(_ExplodingLLM())
    result = service.extract(_sources())

    assert result.available is False
    assert result.candidate_count == 0


def test_extract_keeps_prose_as_summary_without_candidates() -> None:
    service = OntologyGenerationService(_ProseLLM())
    result = service.extract(_sources())

    assert result.available is True
    assert result.candidate_count == 0
    assert result.summary == "I could not find structured candidates in these sources."


def test_extraction_result_round_trips_through_dict() -> None:
    service = OntologyGenerationService(_JsonLLM())
    result = service.extract(_sources())

    payload = result.to_dict()
    assert payload["available"] is True
    assert len(payload["classes"]) == 2
    assert payload["classes"][0]["evidence"][0]["snippet"] == "Invoices are issued"
    assert len(payload["sources"]) == 2
