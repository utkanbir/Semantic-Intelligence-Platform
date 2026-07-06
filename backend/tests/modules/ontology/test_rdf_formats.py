"""Tests for RDF content-type resolution."""

from __future__ import annotations

from app.modules.ontology.services.rdf_formats import resolve_rdf_content_type


def test_resolve_rdf_content_type_maps_turtle() -> None:
    assert resolve_rdf_content_type("ttl") == "text/turtle"
    assert resolve_rdf_content_type(".turtle") == "text/turtle"


def test_resolve_rdf_content_type_maps_owl() -> None:
    assert resolve_rdf_content_type("owl") == "application/rdf+xml"


def test_resolve_rdf_content_type_sniffs_rdf_xml_from_content() -> None:
    xml = '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF>'
    assert resolve_rdf_content_type("ttl", xml) == "application/rdf+xml"


def test_resolve_rdf_content_type_sniffs_turtle_from_content() -> None:
    turtle = "@prefix ex: <http://example.org/> .\nex:A ex:B ."
    assert resolve_rdf_content_type("owl", turtle) == "text/turtle"
