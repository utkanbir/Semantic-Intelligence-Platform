"""Repository interfaces for the agent_runtime module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.modules.agent_runtime.domain.models import AgentRun


class AgentRunRepository(Protocol):
    """Persistence port for agent run rows."""

    def create(self, agent_run: AgentRun) -> AgentRun:
        """Persist a new agent run."""

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[AgentRun]:
        """List runs for an application."""

    def get(self, run_id: UUID) -> AgentRun | None:
        """Fetch run by id."""

    def update(self, agent_run: AgentRun) -> AgentRun | None:
        """Update an existing run."""
