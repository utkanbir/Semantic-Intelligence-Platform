"""Repository interfaces for the assets module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.assets.domain.models import AssetRecord


class AssetRepositoryError(Exception):
    """Base repository error for asset persistence."""


class DuplicateAssetRecordError(AssetRepositoryError):
    """Raised when a duplicate registry entry is persisted."""


class AssetRecordRepository(Protocol):
    """Persistence contract for AssetRecord aggregate operations."""

    def create(self, asset_record: AssetRecord) -> AssetRecord:
        """Persist a new asset record."""

    def list_by_application(
        self,
        application_id: UUID,
        *,
        asset_type: str | None = None,
    ) -> Sequence[AssetRecord]:
        """Return asset records for an application."""

    def get(self, asset_record_id: UUID) -> AssetRecord | None:
        """Return one asset record by id, if present."""

    def update(self, asset_record: AssetRecord) -> AssetRecord | None:
        """Persist modifications for an existing asset record."""
