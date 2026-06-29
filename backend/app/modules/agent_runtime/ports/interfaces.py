"""Port interfaces for the agent_runtime module."""

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


class ExecutableAgentReader(Protocol):
    """Read-only port for agent definition eligibility checks."""

    def get_agent_status(self, agent_id: UUID) -> str | None:
        """Return agent status if found; None if missing."""

    def get_application_id(self, agent_id: UUID) -> UUID | None:
        """Return owning application id if agent exists."""

    def get_bound_product_ids(self, agent_id: UUID) -> list[str] | None:
        """Return bound product ids if agent exists; None if missing."""


class ConsumableProductReader(Protocol):
    """Read-only port for D-003 runtime validation."""

    def get_consumable_status(self, product_id: UUID) -> str | None:
        """Return product status if found; None if missing."""

    def get_application_id(self, product_id: UUID) -> UUID | None:
        """Return owning application id if product exists."""
