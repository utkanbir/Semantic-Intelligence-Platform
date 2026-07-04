"""Repository interfaces for the adapters module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.adapters.domain.models import TechnologyAdapter


class TechnologyAdapterRepository(Protocol):
    """Persistence port for technology adapter rows."""

    def create(self, adapter: TechnologyAdapter) -> TechnologyAdapter:
        """Persist a new adapter."""

    def list_all(
        self,
        *,
        connector_type: str | None = None,
        status: str | None = None,
    ) -> Sequence[TechnologyAdapter]:
        """List adapters with optional filters."""

    def get(self, adapter_id: UUID) -> TechnologyAdapter | None:
        """Fetch adapter by id."""

    def get_by_key(self, adapter_key: str) -> TechnologyAdapter | None:
        """Fetch adapter by unique key."""

    def get_active_by_connector_type(
        self, connector_type: str
    ) -> TechnologyAdapter | None:
        """Return one active adapter for a connector type."""

    def update(self, adapter: TechnologyAdapter) -> TechnologyAdapter | None:
        """Update an existing adapter."""
