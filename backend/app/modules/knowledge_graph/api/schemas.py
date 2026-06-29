"""Pydantic request/response schemas for the knowledge_graph module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.knowledge_graph.domain.enums import KnowledgeGraphRegistryStatus
from app.modules.knowledge_graph.domain.models import KnowledgeGraphRegistry


class KnowledgeGraphRegistryResponse(BaseModel):
    id: UUID
    application_id: UUID
    status: KnowledgeGraphRegistryStatus
    title: str
    description: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    populated_at: datetime | None = None
    graph_updated_at: datetime | None = None
    archived_at: datetime | None = None
    graph_metadata: dict[str, Any]
    bound_ontology_ids: list[str]


class KnowledgeGraphRegistryCreateRequest(BaseModel):
    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    graph_metadata: dict[str, Any] | None = None
    bound_ontology_ids: list[str] | None = None


class KnowledgeGraphRegistryUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    graph_metadata: dict[str, Any] | None = None
    bound_ontology_ids: list[str] | None = None


class KnowledgeGraphRegistryStatusUpdateRequest(BaseModel):
    status: KnowledgeGraphRegistryStatus


def to_knowledge_graph_registry_response(
    registry: KnowledgeGraphRegistry,
) -> KnowledgeGraphRegistryResponse:
    return KnowledgeGraphRegistryResponse(
        id=registry.id,
        application_id=registry.application_id,
        status=registry.status,
        title=registry.title,
        description=registry.description,
        created_by=registry.created_by,
        created_at=registry.created_at,
        updated_at=registry.updated_at,
        populated_at=registry.populated_at,
        graph_updated_at=registry.graph_updated_at,
        archived_at=registry.archived_at,
        graph_metadata=registry.graph_metadata,
        bound_ontology_ids=registry.bound_ontology_ids,
    )
