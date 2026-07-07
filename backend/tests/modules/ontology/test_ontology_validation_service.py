"""Unit tests for ontology validation service."""

from __future__ import annotations

from app.infrastructure.adapters.llm_stub import StubLLMAdapter
from app.modules.ontology.services.ontology_validation_service import (
    OntologyValidationService,
    is_valid_absolute_iri,
)

VALID_TURTLE = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()

DRAFT_DEFINITION = {
    "schema_version": "1",
    "classes": [],
    "properties": [],
    "relationships": [],
    "metadata": {
        "namespace": "http://example.org/onto#",
        "prefix": "ex",
    },
}


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
    assert report.inventory is not None
    assert len(report.inventory.classes) == 1
    assert report.inventory.classes[0].label == "Vendor"
    assert report.inventory.classes[0].local_name == "Vendor"


def test_validate_content_requires_draft_metadata_when_definition_provided() -> None:
    service = OntologyValidationService()
    report = service.validate_content(
        source_content=VALID_TURTLE,
        source_format="ttl",
        ontology_definition={
            **DRAFT_DEFINITION,
            "metadata": {"manual": {"namespace": "http://example.org/onto#"}},
        },
        title="Vendor ontology",
    )

    assert report.passed is False
    assert any(finding.code == "missing_prefix" for finding in report.findings)


def test_validate_content_accepts_metadata_from_definition() -> None:
    service = OntologyValidationService()
    report = service.validate_content(
        source_content=VALID_TURTLE,
        source_format="ttl",
        title="Vendor ontology",
        ontology_definition=DRAFT_DEFINITION,
        include_ai_review=False,
    )

    assert report.passed is True
    assert not any(
        finding.code in {"missing_title", "missing_namespace", "missing_prefix"}
        for finding in report.findings
    )


def test_validate_content_flags_invalid_metadata_values() -> None:
    service = OntologyValidationService()
    report = service.validate_content(
        source_content=VALID_TURTLE,
        source_format="ttl",
        title="Vendor ontology",
        namespace="not-a-valid-iri",
        prefix="9bad",
        include_ai_review=False,
    )

    assert report.passed is False
    assert any(finding.code == "invalid_namespace_iri" for finding in report.findings)
    assert any(finding.code == "invalid_prefix" for finding in report.findings)


def test_validate_content_includes_relation_inventory() -> None:
    service = OntologyValidationService()
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:Order a owl:Class .
ex:Customer a owl:Class .
ex:placedBy a owl:ObjectProperty ;
    rdfs:label "placed by" ;
    rdfs:domain ex:Order ;
    rdfs:range ex:Customer .
ex:orderDate a owl:DatatypeProperty ;
    rdfs:domain ex:Order ;
    rdfs:range xsd:date .
""".strip()
    report = service.validate_content(
        source_content=turtle,
        source_format="ttl",
        include_ai_review=False,
    )

    assert report.inventory is not None
    assert len(report.inventory.classes) == 2
    relation_by_name = {item.local_name: item for item in report.inventory.relations}
    assert relation_by_name["placedBy"].property_type == "object"
    assert relation_by_name["placedBy"].domain.endswith("Order")
    assert relation_by_name["placedBy"].range.endswith("Customer")
    assert relation_by_name["orderDate"].property_type == "datatype"


def test_build_validation_inventory_truncates_when_cap_exceeded() -> None:
    from rdflib import Graph, URIRef
    from rdflib.namespace import OWL, RDF

    from app.modules.ontology.services.ontology_inventory import build_validation_inventory

    graph = Graph()
    class_uris: set[URIRef] = set()
    for index in range(5):
        class_uri = URIRef(f"http://example.org/Class{index}")
        graph.add((class_uri, RDF.type, OWL.Class))
        class_uris.add(class_uri)

    inventory = build_validation_inventory(
        graph,
        class_uris=class_uris,
        object_properties=set(),
        datatype_properties=set(),
        class_cap=3,
        relation_cap=3,
    )

    assert len(inventory.classes) == 3
    assert inventory.truncated is True


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

    assert report.passed is True
    assert any(finding.code == "format_mismatch" for finding in report.findings)


def test_validate_content_detects_invalid_range_reference() -> None:
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
    assert any(finding.code == "invalid_range_reference" for finding in report.findings)


def test_validate_content_detects_duplicate_class_local_names() -> None:
    service = OntologyValidationService()
    turtle = """
@prefix ex: <http://example.org/> .
@prefix acme: <http://acme.com/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:Vendor a owl:Class .
acme:Vendor a owl:Class .
""".strip()
    report = service.validate_content(source_content=turtle, source_format="ttl")

    assert report.passed is False
    assert any(finding.code == "duplicate_local_name" for finding in report.findings)


def test_validate_content_detects_duplicate_iri_for_class_and_property() -> None:
    service = OntologyValidationService()
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:Shared a owl:Class , owl:ObjectProperty .
""".strip()
    report = service.validate_content(source_content=turtle, source_format="ttl")

    assert report.passed is False
    assert any(finding.code == "duplicate_iri" for finding in report.findings)


def test_validate_content_detects_invalid_datatype_range() -> None:
    service = OntologyValidationService()
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Order a owl:Class .
ex:status a owl:DatatypeProperty ;
    rdfs:domain ex:Order ;
    rdfs:range ex:MissingClass .
""".strip()
    report = service.validate_content(source_content=turtle, source_format="ttl")

    assert report.passed is False
    assert any(finding.code == "invalid_range_reference" for finding in report.findings)


def test_validate_structured_definition_duplicate_and_reference_errors() -> None:
    service = OntologyValidationService()
    report = service.validate_content(
        source_content=VALID_TURTLE,
        source_format="ttl",
        ontology_definition={
            "schema_version": "1",
            "classes": [{"name": "Order"}, {"name": "Order"}],
            "properties": [],
            "relationships": [
                {"name": "placedBy", "domain": "Order", "range": "Missing"},
            ],
            "metadata": {
                "namespace": "http://example.org/onto#",
                "prefix": "ex",
            },
        },
        title="Structured draft",
        include_ai_review=False,
    )

    assert report.passed is False
    assert any(finding.code == "duplicate_local_name" for finding in report.findings)
    assert any(finding.code == "invalid_range_reference" for finding in report.findings)


def test_is_valid_absolute_iri() -> None:
    assert is_valid_absolute_iri("http://example.org/onto#")
    assert not is_valid_absolute_iri("relative/path")
    assert not is_valid_absolute_iri("")
