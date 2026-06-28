"""Pydantic request/response schemas for the applications module."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.applications.domain.enums import ApplicationStatus
from app.modules.applications.domain.models import Application


class ApplicationWorkspaceResponse(BaseModel):
    """Workspace payload for application responses."""

    id: UUID
    application_id: UUID
    status: str
    postgres_schema: str
    minio_namespace: str
    fuseki_dataset: str
    qdrant_collection: str
    metadata_domain: str
    ontology_namespace: str
    agent_namespace: str
    product_registry_namespace: str
    agent_registry_namespace: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ApplicationResponse(BaseModel):
    """Application response payload with nested workspace."""

    id: UUID
    key: str
    name: str
    status: ApplicationStatus
    description: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    workspace: ApplicationWorkspaceResponse


class ApplicationCreateRequest(BaseModel):
    """Application creation request payload."""

    key: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class ApplicationUpdateRequest(BaseModel):
    """Application update request payload."""

    key: str | None = Field(default=None, min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class ApplicationStatusUpdateRequest(BaseModel):
    """Application status update request payload."""

    status: ApplicationStatus


def to_application_response(application: Application) -> ApplicationResponse:
    """Map domain model to API response schema."""
    workspace = application.workspace
    if workspace is None:
        raise ValueError("Application workspace is required")
    return ApplicationResponse(
        id=application.id,
        key=application.key,
        name=application.name,
        status=application.status,
        description=application.description,
        created_at=application.created_at,
        updated_at=application.updated_at,
        workspace=ApplicationWorkspaceResponse(
            id=workspace.id,
            application_id=workspace.application_id,
            status=workspace.status,
            postgres_schema=workspace.postgres_schema,
            minio_namespace=workspace.minio_namespace,
            fuseki_dataset=workspace.fuseki_dataset,
            qdrant_collection=workspace.qdrant_collection,
            metadata_domain=workspace.metadata_domain,
            ontology_namespace=workspace.ontology_namespace,
            agent_namespace=workspace.agent_namespace,
            product_registry_namespace=workspace.product_registry_namespace,
            agent_registry_namespace=workspace.agent_registry_namespace,
            created_at=workspace.created_at,
            updated_at=workspace.updated_at,
        ),
    )
