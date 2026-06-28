"""Pydantic request/response schemas for the products module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.products.domain.enums import PublishedDataProductStatus
from app.modules.products.domain.models import PublishedDataProduct


class PublishedDataProductResponse(BaseModel):
    """Published data product response payload."""

    id: UUID
    application_id: UUID
    version_number: int
    previous_version_id: UUID | None = None
    status: PublishedDataProductStatus
    title: str
    description: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    certified_at: datetime | None = None
    published_at: datetime | None = None
    version_created_at: datetime | None = None
    product_definition: dict[str, Any]
    source_asset_record_ids: list[str]


class PublishedDataProductCreateRequest(BaseModel):
    """Published data product creation request."""

    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    product_definition: dict[str, Any] | None = None
    source_asset_record_ids: list[str] | None = None


class PublishedDataProductUpdateRequest(BaseModel):
    """Published data product update request."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    product_definition: dict[str, Any] | None = None
    source_asset_record_ids: list[str] | None = None


def to_published_data_product_response(
    product: PublishedDataProduct,
) -> PublishedDataProductResponse:
    """Map domain model to API response schema."""
    return PublishedDataProductResponse(
        id=product.id,
        application_id=product.application_id,
        version_number=product.version_number,
        previous_version_id=product.previous_version_id,
        status=product.status,
        title=product.title,
        description=product.description,
        created_by=product.created_by,
        created_at=product.created_at,
        updated_at=product.updated_at,
        certified_at=product.certified_at,
        published_at=product.published_at,
        version_created_at=product.version_created_at,
        product_definition=product.product_definition,
        source_asset_record_ids=product.source_asset_record_ids,
    )
