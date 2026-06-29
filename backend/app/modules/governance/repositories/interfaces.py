"""Repository interfaces for the governance module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.governance.domain.models import PolicyDefinition


class PolicyDefinitionRepository(Protocol):
    """Persistence port for policy definition rows."""

    def create(self, policy: PolicyDefinition) -> PolicyDefinition:
        """Persist a new policy."""

    def list_all(self, *, status: str | None = None) -> Sequence[PolicyDefinition]:
        """List policies with optional status filter."""

    def get(self, policy_id: UUID) -> PolicyDefinition | None:
        """Fetch policy by id."""

    def get_by_key(self, policy_key: str) -> PolicyDefinition | None:
        """Fetch policy by unique key."""

    def update(self, policy: PolicyDefinition) -> PolicyDefinition | None:
        """Update an existing policy."""
