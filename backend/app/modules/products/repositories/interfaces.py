"""Repository interfaces for the products module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.products.domain.models import PublishedDataProduct


class PublishedDataProductRepository(Protocol):
    """Persistence contract for PublishedDataProduct aggregate operations."""

    def create(self, product: PublishedDataProduct) -> PublishedDataProduct:
        """Persist a new published data product."""

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[PublishedDataProduct]:
        """Return products for an application."""

    def get(self, product_id: UUID) -> PublishedDataProduct | None:
        """Return one product by id, if present."""

    def update(self, product: PublishedDataProduct) -> PublishedDataProduct | None:
        """Persist modifications for an existing product."""
