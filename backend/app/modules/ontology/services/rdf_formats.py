"""RDF source format helpers for ontology import."""

from __future__ import annotations

RDF_CONTENT_TYPES: dict[str, str] = {
    "ttl": "text/turtle",
    "turtle": "text/turtle",
    "rdf": "application/rdf+xml",
    "xml": "application/rdf+xml",
    "nt": "application/n-triples",
    "ntriples": "application/n-triples",
    "jsonld": "application/ld+json",
    "json-ld": "application/ld+json",
}


def resolve_rdf_content_type(source_format: str) -> str:
    normalized = source_format.lstrip(".").lower()
    return RDF_CONTENT_TYPES.get(normalized, "text/turtle")
