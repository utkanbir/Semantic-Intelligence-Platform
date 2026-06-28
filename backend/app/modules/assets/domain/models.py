"""Domain models for the assets module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.assets.domain.enums import AssetRecordStatus, AssetType


@dataclass(slots=True)
class AssetRecord:
    """Asset registry aggregate root (DM-005)."""

    id: UUID
    application_id: UUID
    asset_type: AssetType
    resource_type: str
    resource_id: str
    status: AssetRecordStatus
    title: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    description: str | None = None
    metadata: dict[str, Any] | None = None
