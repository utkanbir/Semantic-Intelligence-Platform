"""Domain models for the ontology module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.ontology.domain.enums import OntologyDefinitionStatus


@dataclass(slots=True)
class OntologyDefinition:
    """Ontology definition aggregate root."""

    id: UUID
    application_id: UUID
    version_number: int
    status: OntologyDefinitionStatus
    title: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    ontology_definition: dict[str, Any]
    previous_version_id: UUID | None = None
    description: str | None = None
    validated_at: datetime | None = None
    approved_at: datetime | None = None
    published_at: datetime | None = None
    version_created_at: datetime | None = None
