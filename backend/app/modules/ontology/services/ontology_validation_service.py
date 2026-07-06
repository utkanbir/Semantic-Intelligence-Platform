"""Structural and advisory ontology validation."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from rdflib import Graph, URIRef
from rdflib.namespace import OWL, RDF, RDFS

from app.modules.ontology.domain.validation import (
    OntologyValidationInventory,
    OntologyValidationReport,
    ValidationFinding,
)
from app.modules.ontology.services.ontology_inventory import build_validation_inventory
from app.modules.ontology.services.rdf_formats import (
    RDF_CONTENT_TYPES,
    infer_rdf_content_type_from_content,
    resolve_rdf_content_type,
)
from app.shared.ports.llm import LLMPort

_BUILTIN_NAMESPACES = {
    str(RDF),
    str(RDFS),
    str(OWL),
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "http://www.w3.org/2000/01/rdf-schema#",
    "http://www.w3.org/2002/07/owl#",
    "http://www.w3.org/2001/XMLSchema#",
}

_RDFLIB_FORMATS = {
    "text/turtle": "turtle",
    "application/rdf+xml": "xml",
    "application/n-triples": "nt",
    "application/ld+json": "json-ld",
}


class OntologyValidationService:
    """Runs deterministic RDF/OWL checks and optional LLM advisory review."""

    def __init__(self, llm_port: LLMPort | None = None) -> None:
        self._llm_port = llm_port

    def validate_content(
        self,
        *,
        source_content: str,
        source_format: str,
        title: str | None = None,
        description: str | None = None,
        include_ai_review: bool = True,
    ) -> OntologyValidationReport:
        findings: list[ValidationFinding] = []
        stats: dict[str, int] = {}

        content = source_content.strip()
        if not content:
            findings.append(
                ValidationFinding(
                    level="error",
                    code="empty_graph",
                    message="Ontology content is empty",
                )
            )
            return self._build_report(findings, stats, ai_summary=None, inventory=None)

        declared_content_type = resolve_rdf_content_type(source_format, content)
        normalized_format = source_format.lstrip(".").lower()
        mapped_content_type = RDF_CONTENT_TYPES.get(normalized_format)
        inferred_content_type = infer_rdf_content_type_from_content(content)
        if (
            inferred_content_type
            and mapped_content_type
            and inferred_content_type != mapped_content_type
        ):
            findings.append(
                ValidationFinding(
                    level="warning",
                    code="format_mismatch",
                    message=(
                        f"Declared format '{source_format}' does not match detected "
                        f"serialization ({inferred_content_type})"
                    ),
                )
            )

        graph = Graph()
        rdflib_format = _RDFLIB_FORMATS.get(declared_content_type, "turtle")
        try:
            graph.parse(data=content, format=rdflib_format)
        except Exception as error:  # noqa: BLE001 - surface parser errors to users
            findings.append(
                ValidationFinding(
                    level="error",
                    code="parse_failed",
                    message=f"RDF parse failed: {error}",
                )
            )
            return self._build_report(findings, stats, ai_summary=None, inventory=None)

        triple_count = len(graph)
        stats["triple_count"] = triple_count
        if triple_count == 0:
            findings.append(
                ValidationFinding(
                    level="error",
                    code="empty_graph",
                    message="Parsed ontology graph contains no triples",
                )
            )
            return self._build_report(findings, stats, ai_summary=None, inventory=None)

        class_uris = set(graph.subjects(RDF.type, OWL.Class)) | set(
            graph.subjects(RDF.type, RDFS.Class)
        )
        object_properties = set(graph.subjects(RDF.type, OWL.ObjectProperty))
        datatype_properties = set(graph.subjects(RDF.type, OWL.DatatypeProperty))
        properties = object_properties | datatype_properties

        stats["class_count"] = len(class_uris)
        stats["property_count"] = len(properties)

        findings.append(
            ValidationFinding(
                level="info",
                code="stats",
                message=(
                    f"Detected {stats['class_count']} classes, "
                    f"{stats['property_count']} properties, "
                    f"{triple_count} triples"
                ),
            )
        )

        if not self._has_base_namespace(graph, content):
            findings.append(
                ValidationFinding(
                    level="warning",
                    code="missing_base_namespace",
                    message="No owl:Ontology declaration or xml:base attribute detected",
                )
            )

        unlabeled = self._unlabeled_resources(graph, class_uris | properties)
        if unlabeled:
            findings.append(
                ValidationFinding(
                    level="warning",
                    code="unlabeled_resource",
                    message=f"{len(unlabeled)} class/property resources lack rdfs:label",
                )
            )

        dangling = self._dangling_references(graph, class_uris, properties)
        for uri in sorted(dangling)[:10]:
            findings.append(
                ValidationFinding(
                    level="error",
                    code="dangling_reference",
                    message=f"Referenced resource is not defined in the graph: {uri}",
                )
            )
        if len(dangling) > 10:
            findings.append(
                ValidationFinding(
                    level="error",
                    code="dangling_reference",
                    message=f"{len(dangling) - 10} additional dangling references not shown",
                )
            )

        inventory = build_validation_inventory(
            graph,
            class_uris=class_uris,
            object_properties=object_properties,
            datatype_properties=datatype_properties,
        )

        ai_summary = None
        if include_ai_review:
            ai_summary = self._maybe_ai_review(
                findings=findings,
                stats=stats,
                title=title,
                description=description,
            )

        return self._build_report(
            findings, stats, ai_summary=ai_summary, inventory=inventory
        )

    def _build_report(
        self,
        findings: list[ValidationFinding],
        stats: dict[str, int],
        *,
        ai_summary: str | None,
        inventory: OntologyValidationInventory | None,
    ) -> OntologyValidationReport:
        error_count = sum(1 for finding in findings if finding.level == "error")
        warning_count = sum(1 for finding in findings if finding.level == "warning")
        return OntologyValidationReport(
            passed=error_count == 0,
            error_count=error_count,
            warning_count=warning_count,
            findings=findings,
            stats=stats,
            ai_summary=ai_summary,
            inventory=inventory,
            run_at=datetime.now(UTC),
            run_id=uuid4(),
        )

    def _has_base_namespace(self, graph: Graph, content: str) -> bool:
        if 'xml:base="' in content or "owl:Ontology" in content:
            return True
        return any(graph.subjects(RDF.type, OWL.Ontology))

    def _unlabeled_resources(
        self, graph: Graph, resources: set[URIRef]
    ) -> list[URIRef]:
        unlabeled: list[URIRef] = []
        for resource in resources:
            if resource is None:
                continue
            if not any(graph.objects(resource, RDFS.label)):
                unlabeled.append(resource)
        return unlabeled

    def _dangling_references(
        self,
        graph: Graph,
        class_uris: set[URIRef],
        properties: set[URIRef],
    ) -> set[str]:
        defined = {str(node) for node in class_uris | properties if node is not None}
        referenced: set[str] = set()

        for subject in properties:
            if subject is None:
                continue
            for predicate in (RDFS.domain, RDFS.range):
                for obj in graph.objects(subject, predicate):
                    if isinstance(obj, URIRef):
                        referenced.add(str(obj))

        for subject in class_uris:
            if subject is None:
                continue
            for obj in graph.objects(subject, RDFS.subClassOf):
                if isinstance(obj, URIRef):
                    referenced.add(str(obj))

        dangling: set[str] = set()
        for uri in referenced:
            if uri in defined:
                continue
            if any(uri.startswith(namespace) for namespace in _BUILTIN_NAMESPACES):
                continue
            if uri in {str(OWL.Thing), str(OWL.Nothing)}:
                continue
            dangling.add(uri)
        return dangling

    def _maybe_ai_review(
        self,
        *,
        findings: list[ValidationFinding],
        stats: dict[str, int],
        title: str | None,
        description: str | None,
    ) -> str | None:
        if self._llm_port is None:
            return None

        summary_lines = [
            f"Title: {title or 'Untitled'}",
            f"Description: {description or 'None'}",
            f"Stats: {stats}",
        ]
        for finding in findings:
            if finding.level != "info":
                summary_lines.append(f"[{finding.level}] {finding.code}: {finding.message}")

        try:
            return self._llm_port.review_text(
                system_prompt=(
                    "You review OWL/RDF ontologies for semantic quality. "
                    "Respond in 2-4 sentences with practical advisory feedback. "
                    "Do not claim validation passed or failed."
                ),
                user_prompt="\n".join(summary_lines),
            )
        except Exception:  # noqa: BLE001 - advisory only
            return None
