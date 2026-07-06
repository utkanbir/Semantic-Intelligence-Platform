"""Inventory extraction helpers for ontology validation."""

from __future__ import annotations

from rdflib import Graph, Literal, URIRef
from rdflib.namespace import OWL, RDF, RDFS

from app.modules.ontology.domain.validation import (
    INVENTORY_CLASS_CAP,
    INVENTORY_RELATION_CAP,
    OntologyClassSummary,
    OntologyRelationSummary,
    OntologyValidationInventory,
)


def uri_local_name(uri: str) -> str:
    if "#" in uri:
        return uri.rsplit("#", 1)[-1]
    if "/" in uri:
        return uri.rstrip("/").rsplit("/", 1)[-1]
    return uri


def first_label(graph: Graph, resource: URIRef) -> str | None:
    for label in graph.objects(resource, RDFS.label):
        if isinstance(label, Literal):
            value = str(label).strip()
            if value:
                return value
    return None


def first_uri_reference(graph: Graph, resource: URIRef, predicate: URIRef) -> str | None:
    for value in graph.objects(resource, predicate):
        if isinstance(value, URIRef):
            return str(value)
    return None


def build_validation_inventory(
    graph: Graph,
    *,
    class_uris: set[URIRef],
    object_properties: set[URIRef],
    datatype_properties: set[URIRef],
    class_cap: int = INVENTORY_CLASS_CAP,
    relation_cap: int = INVENTORY_RELATION_CAP,
) -> OntologyValidationInventory:
    classes: list[OntologyClassSummary] = []
    for resource in sorted(class_uris, key=str):
        if resource is None:
            continue
        uri = str(resource)
        label = first_label(graph, resource)
        classes.append(
            OntologyClassSummary(
                uri=uri,
                label=label,
                local_name=uri_local_name(uri),
            )
        )

    relations: list[OntologyRelationSummary] = []
    for resource in sorted(object_properties | datatype_properties, key=str):
        if resource is None:
            continue
        uri = str(resource)
        label = first_label(graph, resource)
        property_type = "object" if resource in object_properties else "datatype"
        relations.append(
            OntologyRelationSummary(
                uri=uri,
                label=label,
                local_name=uri_local_name(uri),
                property_type=property_type,
                domain=first_uri_reference(graph, resource, RDFS.domain),
                range=first_uri_reference(graph, resource, RDFS.range),
            )
        )

    truncated = len(classes) > class_cap or len(relations) > relation_cap
    return OntologyValidationInventory(
        classes=classes[:class_cap],
        relations=relations[:relation_cap],
        truncated=truncated,
    )
