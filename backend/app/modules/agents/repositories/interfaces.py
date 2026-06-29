"""Repository interfaces for the agents module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.agents.domain.models import AgentDefinition


class AgentDefinitionRepository(Protocol):
    """Persistence contract for AgentDefinition aggregate operations."""

    def create(self, agent: AgentDefinition) -> AgentDefinition:
        """Persist a new agent definition."""

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[AgentDefinition]:
        """Return agent definitions for an application."""

    def get(self, agent_id: UUID) -> AgentDefinition | None:
        """Return one agent definition by id, if present."""

    def update(self, agent: AgentDefinition) -> AgentDefinition | None:
        """Persist modifications for an existing agent definition."""
