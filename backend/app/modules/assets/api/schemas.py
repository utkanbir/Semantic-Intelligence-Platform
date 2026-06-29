"""Pydantic request/response schemas for the assets module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.assets.domain.enums import AssetRecordStatus, AssetType
from app.modules.assets.domain.models import AssetRecord


class AssetRecordResponse(BaseModel):
    """Asset record response payload."""

    id: UUID
    application_id: UUID
    asset_type: AssetType
    resource_type: str
    resource_id: str
    status: AssetRecordStatus
    title: str
    description: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any] | None = None


class AssetRecordCreateRequest(BaseModel):
    """Asset record creation request."""

    application_id: UUID
    asset_type: AssetType
    resource_type: str = Field(min_length=1, max_length=100)
    resource_id: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    metadata: dict[str, Any] | None = None


class AssetRecordUpdateRequest(BaseModel):
    """Asset record update request."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    metadata: dict[str, Any] | None = None


class AssetRecordStatusUpdateRequest(BaseModel):
    """Asset record status update request."""

    status: AssetRecordStatus


def to_asset_record_response(asset_record: AssetRecord) -> AssetRecordResponse:
    """Map domain model to API response schema."""
    return AssetRecordResponse(
        id=asset_record.id,
        application_id=asset_record.application_id,
        asset_type=asset_record.asset_type,
        resource_type=asset_record.resource_type,
        resource_id=asset_record.resource_id,
        status=asset_record.status,
        title=asset_record.title,
        description=asset_record.description,
        created_by=asset_record.created_by,
        created_at=asset_record.created_at,
        updated_at=asset_record.updated_at,
        metadata=asset_record.metadata,
    )
