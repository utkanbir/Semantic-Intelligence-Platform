"""Pure domain models for the applications module."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from app.modules.applications.domain.enums import ApplicationStatus


@dataclass(slots=True)
class ApplicationWorkspace:
    """Per-application namespace workspace (DM-002, ARR-001)."""

    id: UUID
    application_id: UUID
    status: str = "provisioned"

    postgres_schema: str = ""
    minio_namespace: str = ""
    fuseki_dataset: str = ""
    qdrant_collection: str = ""
    metadata_domain: str = ""
    ontology_namespace: str = ""
    agent_namespace: str = ""
    product_registry_namespace: str = ""
    agent_registry_namespace: str = ""

    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass(slots=True)
class Application:
    """Application aggregate root (DM-001)."""

    id: UUID
    key: str
    name: str
    status: ApplicationStatus
    description: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    workspace: ApplicationWorkspace | None = field(default=None)
