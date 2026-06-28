"""Repository interfaces for the blueprints module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.blueprints.domain.models import Blueprint


class BlueprintRepositoryError(Exception):
    """Base repository error for blueprint persistence."""


class BlueprintNotFoundError(BlueprintRepositoryError):
    """Raised when a blueprint cannot be found."""


class BlueprintRepository(Protocol):
    """Persistence contract for Blueprint aggregate operations."""

    def create(self, blueprint: Blueprint) -> Blueprint:
        """Persist a new blueprint."""

    def list_by_application(self, application_id: UUID) -> Sequence[Blueprint]:
        """Return all blueprints for an application."""

    def get(self, blueprint_id: UUID) -> Blueprint | None:
        """Return one blueprint by id, if present."""

    def update(self, blueprint: Blueprint) -> Blueprint | None:
        """Persist modifications for an existing blueprint."""
