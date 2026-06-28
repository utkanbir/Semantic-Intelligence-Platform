"""Pydantic request/response schemas for the blueprints module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.blueprints.domain.enums import BlueprintStatus
from app.modules.blueprints.domain.models import Blueprint


class BlueprintResponse(BaseModel):
    """Blueprint response payload."""

    id: UUID
    application_id: UUID
    version_number: int
    previous_version_id: UUID | None = None
    status: BlueprintStatus
    title: str
    goal: str | None = None
    outcome: str | None = None
    created_by: str
    created_at: datetime
    approved_at: datetime | None = None
    version_created_at: datetime | None = None
    blueprint_snapshot: dict[str, Any]


class BlueprintCreateRequest(BaseModel):
    """Blueprint creation request."""

    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    goal: str | None = None
    outcome: str | None = None
    blueprint_snapshot: dict[str, Any] | None = None


class BlueprintUpdateRequest(BaseModel):
    """Blueprint update request."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    goal: str | None = None
    outcome: str | None = None
    blueprint_snapshot: dict[str, Any] | None = None


class BlueprintStatusUpdateRequest(BaseModel):
    """Blueprint status update request."""

    status: BlueprintStatus


def to_blueprint_response(blueprint: Blueprint) -> BlueprintResponse:
    """Map domain model to API response schema."""
    return BlueprintResponse(
        id=blueprint.id,
        application_id=blueprint.application_id,
        version_number=blueprint.version_number,
        previous_version_id=blueprint.previous_version_id,
        status=blueprint.status,
        title=blueprint.title,
        goal=blueprint.goal,
        outcome=blueprint.outcome,
        created_by=blueprint.created_by,
        created_at=blueprint.created_at,
        approved_at=blueprint.approved_at,
        version_created_at=blueprint.version_created_at,
        blueprint_snapshot=blueprint.blueprint_snapshot,
    )
