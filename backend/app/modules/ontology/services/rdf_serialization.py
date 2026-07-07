"""Serialize a structured ontology definition to RDF/Turtle (S34-08).

Manual-mode drafts persist a structured ``ontology_definition`` (classes,
object relationships, data properties, metadata) instead of raw RDF text.
Materialize (write to the connector named graph) and server-side validation
need a concrete RDF artifact, so this module renders the structured draft to
deterministic Turtle using rdflib. Import-mode drafts already carry raw source
content and never reach this path.
"""

from __future__ import annotations

from typing import Any

from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.namespace import OWL, RDF, RDFS, XSD

_NAMESPACE_KEYS = ("namespace", "namespace_iri", "base_iri", "namespaceIri")
_PREFIX_KEYS = ("prefix",)
_DEFAULT_NAMESPACE = "https://sip.local/ontology#"


def serialize_definition_to_turtle(ontology_definition: dict[str, Any]) -> str | None:
    """Render a structured ontology definition to Turtle.

    Returns ``None`` when the definition carries no classes, relationships, or
    data properties (nothing meaningful to write to the graph store).
    """

    classes = _as_dict_list(ontology_definition.get("classes"))
    properties = _as_dict_list(ontology_definition.get("properties"))
    relationships = _as_dict_list(ontology_definition.get("relationships"))
    if not classes and not properties and not relationships:
        return None

    namespace = _resolve_namespace(ontology_definition)
    ns = Namespace(namespace)
    graph = Graph()
    graph.bind(_resolve_prefix(ontology_definition) or "ns", ns)
    graph.bind("owl", OWL)
    graph.bind("rdfs", RDFS)

    ontology_iri = URIRef(namespace.rstrip("#/")) if namespace.rstrip("#/") else URIRef(namespace)
    graph.add((ontology_iri, RDF.type, OWL.Ontology))

    class_iri_by_name: dict[str, URIRef] = {}
    for item in classes:
        name = _clean(item.get("name"))
        if name is None:
            continue
        iri = _explicit_iri(item) or _term(namespace, name)
        class_iri_by_name[name] = iri
        graph.add((iri, RDF.type, OWL.Class))
        graph.add((iri, RDFS.label, Literal(_clean(item.get("label")) or name)))
        description = _clean(item.get("description"))
        if description is not None:
            graph.add((iri, RDFS.comment, Literal(description)))

    for item in relationships:
        name = _clean(item.get("name"))
        if name is None:
            continue
        iri = _explicit_iri(item) or _term(namespace, name)
        graph.add((iri, RDF.type, OWL.ObjectProperty))
        graph.add((iri, RDFS.label, Literal(_clean(item.get("label")) or name)))
        domain = _class_reference(item.get("domain") or item.get("domain_class"),
                                  class_iri_by_name, namespace)
        if domain is not None:
            graph.add((iri, RDFS.domain, domain))
        range_ref = _class_reference(item.get("range") or item.get("range_class"),
                                     class_iri_by_name, namespace)
        if range_ref is not None:
            graph.add((iri, RDFS.range, range_ref))

    for item in properties:
        name = _clean(item.get("name"))
        if name is None:
            continue
        iri = _explicit_iri(item) or _term(namespace, name)
        graph.add((iri, RDF.type, OWL.DatatypeProperty))
        graph.add((iri, RDFS.label, Literal(_clean(item.get("label")) or name)))
        domain = _class_reference(item.get("domain") or item.get("domain_class"),
                                  class_iri_by_name, namespace)
        if domain is not None:
            graph.add((iri, RDFS.domain, domain))
        datatype = _resolve_datatype(item.get("datatype") or item.get("range"))
        if datatype is not None:
            graph.add((iri, RDFS.range, datatype))

    return graph.serialize(format="turtle")


def _as_dict_list(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, dict)]


def _clean(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _read_metadata_field(metadata: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = _clean(metadata.get(key))
        if value is not None:
            return value
    return None


def _resolve_namespace(ontology_definition: dict[str, Any]) -> str:
    metadata = ontology_definition.get("metadata")
    if isinstance(metadata, dict):
        namespace = _read_metadata_field(metadata, _NAMESPACE_KEYS)
        manual = metadata.get("manual")
        if namespace is None and isinstance(manual, dict):
            namespace = _read_metadata_field(manual, _NAMESPACE_KEYS)
        if namespace is not None:
            return namespace if namespace.endswith(("#", "/")) else f"{namespace}#"
    return _DEFAULT_NAMESPACE


def _resolve_prefix(ontology_definition: dict[str, Any]) -> str | None:
    metadata = ontology_definition.get("metadata")
    if isinstance(metadata, dict):
        prefix = _read_metadata_field(metadata, _PREFIX_KEYS)
        manual = metadata.get("manual")
        if prefix is None and isinstance(manual, dict):
            prefix = _read_metadata_field(manual, _PREFIX_KEYS)
        return prefix
    return None


def _explicit_iri(item: dict[str, Any]) -> URIRef | None:
    iri = _clean(item.get("iri")) or _clean(item.get("uri"))
    if iri is not None and ("://" in iri or iri.startswith("urn:")):
        return URIRef(iri)
    return None


def _term(namespace: str, name: str) -> URIRef:
    local = name.strip().replace(" ", "")
    return URIRef(f"{namespace}{local}")


def _class_reference(
    value: Any,
    class_iri_by_name: dict[str, URIRef],
    namespace: str,
) -> URIRef | None:
    name = _clean(value)
    if name is None:
        return None
    if name in class_iri_by_name:
        return class_iri_by_name[name]
    if "://" in name or name.startswith("urn:"):
        return URIRef(name)
    return _term(namespace, name)


def _resolve_datatype(value: Any) -> URIRef | None:
    name = _clean(value)
    if name is None:
        return None
    if "://" in name:
        return URIRef(name)
    local = name.split(":")[-1] if ":" in name else name
    return URIRef(f"{XSD}{local}")
