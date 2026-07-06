"""Unit tests for ontology validation service."""

from __future__ import annotations

from app.infrastructure.adapters.llm_stub import StubLLMAdapter
from app.modules.ontology.services.ontology_validation_service import OntologyValidationService

VALID_TURTLE = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()


def test_validate_content_passes_valid_turtle() -> None:
    service = OntologyValidationService(StubLLMAdapter())
    report = service.validate_content(
        source_content=VALID_TURTLE,
        source_format="ttl",
        title="Vendor ontology",
    )

    assert report.passed is True
    assert report.error_count == 0
    assert report.stats["triple_count"] > 0
    assert report.ai_summary is not None


def test_validate_content_rejects_empty_content() -> None:
    service = OntologyValidationService()
    report = service.validate_content(source_content="   ", source_format="ttl")

    assert report.passed is False
    assert report.error_count == 1
    assert any(finding.code == "empty_graph" for finding in report.findings)


def test_validate_content_rejects_invalid_rdf() -> None:
    service = OntologyValidationService()
    report = service.validate_content(
        source_content="@prefix ex: <http://example.org/> .\nex:Broken ",
        source_format="ttl",
    )

    assert report.passed is False
    assert any(finding.code == "parse_failed" for finding in report.findings)


def test_validate_content_detects_format_mismatch_warning() -> None:
    service = OntologyValidationService()
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
ex:Vendor a owl:Class .
""".strip()
    report = service.validate_content(source_content=turtle, source_format="rdf")

    assert any(finding.code == "format_mismatch" for finding in report.findings)


def test_validate_content_detects_dangling_reference() -> None:
    service = OntologyValidationService()
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Order a owl:Class .
ex:shipsTo a owl:ObjectProperty ;
    rdfs:domain ex:Order ;
    rdfs:range ex:MissingClass .
""".strip()
    report = service.validate_content(source_content=turtle, source_format="ttl")

    assert report.passed is False
    assert any(finding.code == "dangling_reference" for finding in report.findings)
