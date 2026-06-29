"""Domain enumerations for the ontology module."""

from __future__ import annotations

from enum import StrEnum


class OntologyDefinitionStatus(StrEnum):
    """OntologyDefinition lifecycle states (ARR-002)."""

    DRAFT = "Draft"
    VALIDATED = "Validated"
    APPROVED = "Approved"
    PUBLISHED = "Published"
    VERSIONED = "Versioned"
    RETIRED = "Retired"
