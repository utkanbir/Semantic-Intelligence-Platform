"""Domain models for the products module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.products.domain.enums import PublishedDataProductStatus


@dataclass(slots=True)
class PublishedDataProduct:
    """Published data product aggregate root (DM-008)."""

    id: UUID
    application_id: UUID
    version_number: int
    status: PublishedDataProductStatus
    title: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    product_definition: dict[str, Any]
    source_asset_record_ids: list[str]
    previous_version_id: UUID | None = None
    description: str | None = None
    certified_at: datetime | None = None
    published_at: datetime | None = None
    version_created_at: datetime | None = None
