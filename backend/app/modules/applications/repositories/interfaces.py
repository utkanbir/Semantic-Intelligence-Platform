"""Repository interfaces for the applications module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.applications.domain.models import Application


class ApplicationRepositoryError(Exception):
    """Base repository error for applications persistence."""


class DuplicateApplicationKeyError(ApplicationRepositoryError):
    """Raised when attempting to persist an already-used application key."""


class ApplicationRepository(Protocol):
    """Persistence contract for Application aggregate operations."""

    def create(self, application: Application) -> Application:
        """Persist a new application aggregate."""

    def list(self) -> Sequence[Application]:
        """Return all persisted applications."""

    def get(self, application_id: UUID) -> Application | None:
        """Return one application by id, if present."""

    def get_by_key(self, key: str) -> Application | None:
        """Return one application by key, if present."""

    def update(self, application: Application) -> Application | None:
        """Persist modifications for an existing application."""

    def delete(self, application_id: UUID) -> bool:
        """Delete one application by id. Returns True when removed."""
