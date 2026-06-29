"""Pydantic request/response schemas for the agents module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.agents.domain.enums import AgentDefinitionStatus
from app.modules.agents.domain.models import AgentDefinition


class AgentDefinitionResponse(BaseModel):
    """Agent definition response payload."""

    id: UUID
    application_id: UUID
    version_number: int
    previous_version_id: UUID | None = None
    status: AgentDefinitionStatus
    title: str
    description: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None
    activated_at: datetime | None = None
    version_created_at: datetime | None = None
    agent_definition: dict[str, Any]
    bound_product_ids: list[str]


class AgentDefinitionCreateRequest(BaseModel):
    """Agent definition creation request."""

    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    agent_definition: dict[str, Any] | None = None
    bound_product_ids: list[str] | None = None


class AgentDefinitionUpdateRequest(BaseModel):
    """Agent definition update request."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    agent_definition: dict[str, Any] | None = None
    bound_product_ids: list[str] | None = None


class AgentDefinitionStatusUpdateRequest(BaseModel):
    """Agent definition status update request."""

    status: AgentDefinitionStatus


class AgentDefinitionVersionCreateRequest(BaseModel):
    """Agent definition version fork request."""

    agent_definition: dict[str, Any] | None = None
    bound_product_ids: list[str] | None = None


def to_agent_definition_response(agent: AgentDefinition) -> AgentDefinitionResponse:
    """Map domain model to API response schema."""
    return AgentDefinitionResponse(
        id=agent.id,
        application_id=agent.application_id,
        version_number=agent.version_number,
        previous_version_id=agent.previous_version_id,
        status=agent.status,
        title=agent.title,
        description=agent.description,
        created_by=agent.created_by,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        approved_at=agent.approved_at,
        activated_at=agent.activated_at,
        version_created_at=agent.version_created_at,
        agent_definition=agent.agent_definition,
        bound_product_ids=agent.bound_product_ids,
    )
