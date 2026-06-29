"""Port interfaces for the agents module."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID


class TraceRecorder(Protocol):
    """Outbound port for recording semantic transactions."""

    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        """Persist one semantic transaction record."""


class ConsumableProductReader(Protocol):
    """Read-only port for D-003 product binding validation."""

    def get_consumable_status(self, product_id: UUID) -> str | None:
        """Return product status if found; None if missing."""

    def get_application_id(self, product_id: UUID) -> UUID | None:
        """Return owning application id if product exists."""
