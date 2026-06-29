"""Pydantic request/response schemas for the agent_runtime module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.agent_runtime.domain.enums import AgentRunStatus
from app.modules.agent_runtime.domain.models import AgentRun


class AgentRunResponse(BaseModel):
    id: UUID
    application_id: UUID
    agent_definition_id: UUID
    status: AgentRunStatus
    created_by: str
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    run_payload: dict[str, Any]
    run_result: dict[str, Any] | None = None


class AgentRunCreateRequest(BaseModel):
    application_id: UUID
    agent_definition_id: UUID
    created_by: str | None = Field(default=None, max_length=255)
    run_payload: dict[str, Any] | None = None


def to_agent_run_response(agent_run: AgentRun) -> AgentRunResponse:
    return AgentRunResponse(
        id=agent_run.id,
        application_id=agent_run.application_id,
        agent_definition_id=agent_run.agent_definition_id,
        status=agent_run.status,
        created_by=agent_run.created_by,
        created_at=agent_run.created_at,
        updated_at=agent_run.updated_at,
        started_at=agent_run.started_at,
        completed_at=agent_run.completed_at,
        run_payload=agent_run.run_payload,
        run_result=agent_run.run_result,
    )
