"""Structural and advisory ontology validation."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, cast
from urllib.parse import urlparse
from uuid import uuid4

from rdflib import BNode, Graph, URIRef
from rdflib.namespace import OWL, RDF, RDFS, XSD

from app.modules.ontology.domain.validation import (
    OntologyValidationInventory,
    OntologyValidationReport,
    ValidationFinding,
)
from app.modules.ontology.services.ontology_inventory import (
    build_validation_inventory,
    uri_local_name,
)
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
    str(XSD),
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

_PARSE_FALLBACK_ORDER = ("turtle", "xml", "json-ld", "nt")

_PREFIX_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")

_METADATA_NAMESPACE_KEYS = ("namespace", "namespace_iri", "base_iri", "namespaceIri")
_METADATA_PREFIX_KEYS = ("prefix",)


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
        namespace: str | None = None,
        prefix: str | None = None,
        ontology_definition: dict[str, Any] | None = None,
        include_ai_review: bool = True,
    ) -> OntologyValidationReport:
        findings: list[ValidationFinding] = []
        stats: dict[str, int] = {}

        resolved_title, resolved_namespace, resolved_prefix = self._resolve_metadata_values(
            title=title,
            namespace=namespace,
            prefix=prefix,
            ontology_definition=ontology_definition,
        )
        validate_metadata = self._should_validate_draft_metadata(
            ontology_definition=ontology_definition,
            namespace=namespace,
            prefix=prefix,
        )
        if validate_metadata:
            findings.extend(
                self._validate_required_metadata(
                    title=resolved_title,
                    namespace=resolved_namespace,
                    prefix=resolved_prefix,
                )
            )

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

        if ontology_definition is not None:
            findings.extend(self._validate_structured_definition(ontology_definition))

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
            graph = self._parse_graph(content, rdflib_format)
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

        class_uris = cast(
            set[URIRef],
            set(graph.subjects(RDF.type, OWL.Class))
            | set(graph.subjects(RDF.type, RDFS.Class)),
        )
        object_properties = cast(
            set[URIRef], set(graph.subjects(RDF.type, OWL.ObjectProperty))
        )
        datatype_properties = cast(
            set[URIRef], set(graph.subjects(RDF.type, OWL.DatatypeProperty))
        )
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

        findings.extend(self._invalid_iri_findings(class_uris | properties))
        findings.extend(self._duplicate_name_findings(class_uris, properties))
        findings.extend(self._duplicate_iri_findings(class_uris, properties))

        unlabeled = self._unlabeled_resources(graph, class_uris | properties)
        if unlabeled:
            findings.append(
                ValidationFinding(
                    level="warning",
                    code="unlabeled_resource",
                    message=f"{len(unlabeled)} class/property resources lack rdfs:label",
                )
            )

        findings.extend(
            self._property_reference_findings(
                graph,
                class_uris=class_uris,
                object_properties=object_properties,
                datatype_properties=datatype_properties,
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
                title=resolved_title or title,
                description=description,
            )

        return self._build_report(
            findings, stats, ai_summary=ai_summary, inventory=inventory
        )

    def _parse_graph(self, content: str, primary_format: str) -> Graph:
        last_error: Exception | None = None
        seen: set[str] = set()
        for fmt in (primary_format, *_PARSE_FALLBACK_ORDER):
            if fmt in seen:
                continue
            seen.add(fmt)
            graph = Graph()
            try:
                graph.parse(data=content, format=fmt)
            except Exception as error:  # noqa: BLE001
                last_error = error
                continue
            return graph
        if last_error is None:
            raise ValueError("RDF parse failed")
        raise last_error

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

    def _resolve_metadata_values(
        self,
        *,
        title: str | None,
        namespace: str | None,
        prefix: str | None,
        ontology_definition: dict[str, Any] | None,
    ) -> tuple[str | None, str | None, str | None]:
        resolved_namespace = namespace
        resolved_prefix = prefix
        if ontology_definition is not None:
            definition_namespace, definition_prefix = self._read_definition_metadata(
                ontology_definition
            )
            if resolved_namespace is None:
                resolved_namespace = definition_namespace
            if resolved_prefix is None:
                resolved_prefix = definition_prefix
        return title, resolved_namespace, resolved_prefix

    def _read_definition_metadata(
        self, ontology_definition: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        metadata = ontology_definition.get("metadata")
        if not isinstance(metadata, dict):
            return None, None

        namespace = self._read_metadata_field(metadata, _METADATA_NAMESPACE_KEYS)
        prefix = self._read_metadata_field(metadata, _METADATA_PREFIX_KEYS)
        manual = metadata.get("manual")
        if isinstance(manual, dict):
            if namespace is None:
                namespace = self._read_metadata_field(manual, _METADATA_NAMESPACE_KEYS)
            if prefix is None:
                prefix = self._read_metadata_field(manual, _METADATA_PREFIX_KEYS)
        return namespace, prefix

    def _read_metadata_field(self, metadata: dict[str, Any], keys: tuple[str, ...]) -> str | None:
        for key in keys:
            value = metadata.get(key)
            if isinstance(value, str):
                stripped = value.strip()
                if stripped:
                    return stripped
        return None

    def _should_validate_draft_metadata(
        self,
        *,
        ontology_definition: dict[str, Any] | None,
        namespace: str | None,
        prefix: str | None,
    ) -> bool:
        if namespace is not None or prefix is not None:
            return True
        if ontology_definition is None:
            return False
        metadata = ontology_definition.get("metadata")
        if not isinstance(metadata, dict):
            return False
        if isinstance(metadata.get("manual"), dict):
            return True
        for key in (*_METADATA_NAMESPACE_KEYS, *_METADATA_PREFIX_KEYS):
            if key in metadata:
                return True
        manual = metadata.get("manual")
        if isinstance(manual, dict):
            for key in (*_METADATA_NAMESPACE_KEYS, *_METADATA_PREFIX_KEYS):
                if key in manual:
                    return True
        return False

    def _validate_required_metadata(
        self,
        *,
        title: str | None,
        namespace: str | None,
        prefix: str | None,
    ) -> list[ValidationFinding]:
        findings: list[ValidationFinding] = []
        if not title or not title.strip():
            findings.append(
                ValidationFinding(
                    level="error",
                    code="missing_title",
                    message="Ontology title is required",
                )
            )
        if not namespace or not namespace.strip():
            findings.append(
                ValidationFinding(
                    level="error",
                    code="missing_namespace",
                    message="Ontology namespace (base IRI) is required",
                )
            )
        elif not is_valid_absolute_iri(namespace.strip()):
            findings.append(
                ValidationFinding(
                    level="error",
                    code="invalid_namespace_iri",
                    message=f"Namespace is not a valid absolute IRI: {namespace.strip()}",
                )
            )
        if not prefix or not prefix.strip():
            findings.append(
                ValidationFinding(
                    level="error",
                    code="missing_prefix",
                    message="Ontology prefix is required",
                )
            )
        elif not _PREFIX_PATTERN.fullmatch(prefix.strip()):
            findings.append(
                ValidationFinding(
                    level="error",
                    code="invalid_prefix",
                    message=(
                        "Prefix must start with a letter and contain only letters, "
                        "digits, underscores, or hyphens"
                    ),
                )
            )
        return findings

    def _validate_structured_definition(
        self, ontology_definition: dict[str, Any]
    ) -> list[ValidationFinding]:
        findings: list[ValidationFinding] = []
        classes = ontology_definition.get("classes")
        properties = ontology_definition.get("properties")
        relationships = ontology_definition.get("relationships")

        class_names: list[str] = []
        if isinstance(classes, list):
            for item in classes:
                if not isinstance(item, dict):
                    continue
                name = item.get("name")
                if isinstance(name, str) and name.strip():
                    class_names.append(name.strip())
                iri = item.get("iri") or item.get("uri")
                if isinstance(iri, str) and iri.strip() and not is_valid_absolute_iri(iri.strip()):
                    findings.append(
                        ValidationFinding(
                            level="error",
                            code="invalid_iri",
                            message=f"Class has invalid IRI: {iri.strip()}",
                        )
                    )

        property_names: list[str] = []
        if isinstance(properties, list):
            for item in properties:
                if not isinstance(item, dict):
                    continue
                name = item.get("name")
                if isinstance(name, str) and name.strip():
                    property_names.append(name.strip())
                iri = item.get("iri") or item.get("uri")
                if isinstance(iri, str) and iri.strip() and not is_valid_absolute_iri(iri.strip()):
                    findings.append(
                        ValidationFinding(
                            level="error",
                            code="invalid_iri",
                            message=f"Property has invalid IRI: {iri.strip()}",
                        )
                    )

        defined_names = set(class_names)
        findings.extend(self._duplicate_name_list_findings(class_names, resource_kind="class"))

        if isinstance(relationships, list):
            for item in relationships:
                if not isinstance(item, dict):
                    continue
                name = item.get("name")
                if isinstance(name, str) and name.strip():
                    property_names.append(name.strip())
                domain = item.get("domain") or item.get("domain_class")
                range_value = item.get("range") or item.get("range_class")
                domain_name = domain.strip() if isinstance(domain, str) else ""
                if domain_name and domain_name not in defined_names:
                    findings.append(
                        ValidationFinding(
                            level="error",
                            code="invalid_domain_reference",
                            message=(
                                f"Relationship domain '{domain_name}' "
                                "does not reference a defined class"
                            ),
                        )
                    )
                if (
                    isinstance(range_value, str)
                    and range_value.strip()
                    and not is_xsd_datatype(range_value.strip())
                    and range_value.strip() not in defined_names
                ):
                    findings.append(
                        ValidationFinding(
                            level="error",
                            code="invalid_range_reference",
                            message=(
                                f"Relationship range '{range_value.strip()}' "
                                "does not reference a defined class or XSD datatype"
                            ),
                        )
                    )

        findings.extend(
            self._duplicate_name_list_findings(property_names, resource_kind="property")
        )
        return findings

    def _duplicate_name_list_findings(
        self, names: list[str], *, resource_kind: str
    ) -> list[ValidationFinding]:
        findings: list[ValidationFinding] = []
        seen: dict[str, int] = {}
        for name in names:
            seen[name] = seen.get(name, 0) + 1
        for name, count in sorted(seen.items()):
            if count > 1:
                findings.append(
                    ValidationFinding(
                        level="error",
                        code="duplicate_local_name",
                        message=(
                            f"Duplicate {resource_kind} local name '{name}' "
                            f"appears {count} times"
                        ),
                    )
                )
        return findings

    def _invalid_iri_findings(self, resources: set[URIRef]) -> list[ValidationFinding]:
        findings: list[ValidationFinding] = []
        for resource in resources:
            if resource is None or isinstance(resource, BNode):
                findings.append(
                    ValidationFinding(
                        level="error",
                        code="invalid_iri",
                        message="Class or property must use an absolute IRI, not a blank node",
                    )
                )
                continue
            uri = str(resource)
            if not is_valid_absolute_iri(uri):
                findings.append(
                    ValidationFinding(
                        level="error",
                        code="invalid_iri",
                        message=f"Invalid IRI for class or property: {uri}",
                    )
                )
        return findings

    def _duplicate_name_findings(
        self,
        class_uris: set[URIRef],
        properties: set[URIRef],
    ) -> list[ValidationFinding]:
        findings: list[ValidationFinding] = []
        findings.extend(
            self._duplicate_uri_local_name_findings(class_uris, resource_kind="class")
        )
        findings.extend(
            self._duplicate_uri_local_name_findings(properties, resource_kind="property")
        )
        return findings

    def _duplicate_uri_local_name_findings(
        self, resources: set[URIRef], *, resource_kind: str
    ) -> list[ValidationFinding]:
        grouped: dict[str, list[str]] = {}
        for resource in resources:
            if resource is None:
                continue
            local_name = uri_local_name(str(resource))
            grouped.setdefault(local_name, []).append(str(resource))
        findings: list[ValidationFinding] = []
        for local_name, uris in sorted(grouped.items()):
            if len(uris) > 1:
                findings.append(
                    ValidationFinding(
                        level="error",
                        code="duplicate_local_name",
                        message=(
                            f"Duplicate {resource_kind} local name '{local_name}' "
                            f"used by {len(uris)} IRIs"
                        ),
                    )
                )
        return findings

    def _duplicate_iri_findings(
        self,
        class_uris: set[URIRef],
        properties: set[URIRef],
    ) -> list[ValidationFinding]:
        overlap = {
            str(resource)
            for resource in class_uris & properties
            if resource is not None
        }
        return [
            ValidationFinding(
                level="error",
                code="duplicate_iri",
                message=f"IRI is declared as both a class and a property: {uri}",
            )
            for uri in sorted(overlap)
        ]

    def _property_reference_findings(
        self,
        graph: Graph,
        *,
        class_uris: set[URIRef],
        object_properties: set[URIRef],
        datatype_properties: set[URIRef],
    ) -> list[ValidationFinding]:
        defined_classes = {str(node) for node in class_uris if node is not None}
        findings: list[ValidationFinding] = []

        for subject in object_properties | datatype_properties:
            if subject is None:
                continue
            property_iri = str(subject)
            property_kind = "object" if subject in object_properties else "datatype"
            domain_values = [
                str(obj) for obj in graph.objects(subject, RDFS.domain) if isinstance(obj, URIRef)
            ]
            range_values = [
                str(obj) for obj in graph.objects(subject, RDFS.range) if isinstance(obj, URIRef)
            ]

            if not domain_values:
                findings.append(
                    ValidationFinding(
                        level="warning",
                        code="missing_domain",
                        message=f"Property {property_iri} has no rdfs:domain",
                    )
                )
            for domain in domain_values:
                if domain in defined_classes or _is_builtin_class_reference(domain):
                    continue
                findings.append(
                    ValidationFinding(
                        level="error",
                        code="invalid_domain_reference",
                        message=(
                            f"Property {property_iri} domain '{domain}' "
                            "does not reference a defined class"
                        ),
                    )
                )

            if not range_values:
                findings.append(
                    ValidationFinding(
                        level="warning",
                        code="missing_range",
                        message=f"Property {property_iri} has no rdfs:range",
                    )
                )
            for range_value in range_values:
                if property_kind == "datatype":
                    if is_xsd_datatype(range_value) or _is_builtin_class_reference(range_value):
                        continue
                    findings.append(
                        ValidationFinding(
                            level="error",
                            code="invalid_range_reference",
                            message=(
                                f"Datatype property {property_iri} range '{range_value}' "
                                "must reference an XSD datatype"
                            ),
                        )
                    )
                    continue
                if range_value in defined_classes or _is_builtin_class_reference(range_value):
                    continue
                findings.append(
                    ValidationFinding(
                        level="error",
                        code="invalid_range_reference",
                        message=(
                            f"Object property {property_iri} range '{range_value}' "
                            "does not reference a defined class"
                        ),
                    )
                )

        for subject in class_uris:
            if subject is None:
                continue
            for obj in graph.objects(subject, RDFS.subClassOf):
                if not isinstance(obj, URIRef):
                    continue
                parent = str(obj)
                if parent in defined_classes or _is_builtin_class_reference(parent):
                    continue
                findings.append(
                    ValidationFinding(
                        level="error",
                        code="invalid_domain_reference",
                        message=(
                            f"Class {subject} rdfs:subClassOf '{parent}' "
                            "does not reference a defined class"
                        ),
                    )
                )

        return findings

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


def is_valid_absolute_iri(value: str) -> bool:
    if not value or any(char.isspace() for char in value):
        return False
    parsed = urlparse(value)
    if not parsed.scheme:
        return False
    return bool(parsed.netloc or parsed.path)


def is_xsd_datatype(value: str) -> bool:
    return value.startswith(str(XSD)) or value in {
        str(XSD.string),
        str(XSD.boolean),
        str(XSD.date),
        str(XSD.dateTime),
        str(XSD.decimal),
        str(XSD.double),
        str(XSD.float),
        str(XSD.integer),
        str(XSD.long),
    }


def _is_builtin_class_reference(uri: str) -> bool:
    if uri in {str(OWL.Thing), str(OWL.Nothing)}:
        return True
    return any(uri.startswith(namespace) for namespace in _BUILTIN_NAMESPACES)
