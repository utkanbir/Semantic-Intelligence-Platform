"""Pydantic request/response schemas for the ontology module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.ontology.domain.enums import OntologyDefinitionStatus
from app.modules.ontology.domain.models import OntologyDefinition


class OntologyDefinitionResponse(BaseModel):
    id: UUID
    application_id: UUID
    version_number: int
    previous_version_id: UUID | None = None
    status: OntologyDefinitionStatus
    title: str
    description: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    validated_at: datetime | None = None
    approved_at: datetime | None = None
    published_at: datetime | None = None
    version_created_at: datetime | None = None
    ontology_definition: dict[str, Any]


class OntologyDefinitionCreateRequest(BaseModel):
    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    ontology_definition: dict[str, Any] | None = None


class OntologyDefinitionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    ontology_definition: dict[str, Any] | None = None


class OntologyDefinitionStatusUpdateRequest(BaseModel):
    status: OntologyDefinitionStatus


class OntologyDefinitionVersionCreateRequest(BaseModel):
    ontology_definition: dict[str, Any] | None = None


def to_ontology_definition_response(
    ontology: OntologyDefinition,
) -> OntologyDefinitionResponse:
    return OntologyDefinitionResponse(
        id=ontology.id,
        application_id=ontology.application_id,
        version_number=ontology.version_number,
        previous_version_id=ontology.previous_version_id,
        status=ontology.status,
        title=ontology.title,
        description=ontology.description,
        created_by=ontology.created_by,
        created_at=ontology.created_at,
        updated_at=ontology.updated_at,
        validated_at=ontology.validated_at,
        approved_at=ontology.approved_at,
        published_at=ontology.published_at,
        version_created_at=ontology.version_created_at,
        ontology_definition=ontology.ontology_definition,
    )
