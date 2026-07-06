"""RDF source format helpers for ontology import."""

from __future__ import annotations

RDF_CONTENT_TYPES: dict[str, str] = {
    "ttl": "text/turtle",
    "turtle": "text/turtle",
    "rdf": "application/rdf+xml",
    "xml": "application/rdf+xml",
    "owl": "application/rdf+xml",
    "nt": "application/n-triples",
    "ntriples": "application/n-triples",
    "jsonld": "application/ld+json",
    "json-ld": "application/ld+json",
}


def infer_rdf_content_type_from_content(content: str) -> str | None:
    stripped = content.lstrip()
    if not stripped:
        return None
    if stripped.startswith("<?xml") or stripped.startswith("<rdf:RDF"):
        return "application/rdf+xml"
    if stripped.startswith("{") or stripped.startswith("["):
        return "application/ld+json"
    if stripped.startswith("@prefix") or stripped.startswith("PREFIX "):
        return "text/turtle"
    return None


def resolve_rdf_content_type(source_format: str, content: str | None = None) -> str:
    normalized = source_format.lstrip(".").lower()
    mapped = RDF_CONTENT_TYPES.get(normalized)
    inferred = infer_rdf_content_type_from_content(content) if content else None

    if inferred is not None and mapped is not None and inferred != mapped:
        return inferred
    if mapped is not None:
        return mapped
    if inferred is not None:
        return inferred
    return "text/turtle"
