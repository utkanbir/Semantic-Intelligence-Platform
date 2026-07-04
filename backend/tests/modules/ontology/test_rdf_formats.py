"""Tests for RDF content-type resolution."""

from __future__ import annotations

from app.modules.ontology.services.rdf_formats import resolve_rdf_content_type


def test_resolve_rdf_content_type_maps_turtle() -> None:
    assert resolve_rdf_content_type("ttl") == "text/turtle"
    assert resolve_rdf_content_type(".turtle") == "text/turtle"
