"""Domain models for the agent_runtime module."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.agent_runtime.domain.enums import AgentRunStatus


@dataclass(slots=True)
class AgentRun:
    """Agent run execution aggregate root."""

    id: UUID
    application_id: UUID
    agent_definition_id: UUID
    status: AgentRunStatus
    created_by: str
    created_at: datetime
    updated_at: datetime
    run_payload: dict[str, Any]
    started_at: datetime | None = None
    completed_at: datetime | None = None
    run_result: dict[str, Any] | None = None
