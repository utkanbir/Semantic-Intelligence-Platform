"""Pydantic request/response schemas for the governance module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.governance.domain.enums import PolicyDefinitionStatus
from app.modules.governance.domain.models import PolicyDefinition


class PolicyDefinitionResponse(BaseModel):
    id: UUID
    policy_key: str
    status: PolicyDefinitionStatus
    title: str
    description: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None
    activated_at: datetime | None = None
    retired_at: datetime | None = None
    policy_definition: dict[str, Any]


class PolicyDefinitionCreateRequest(BaseModel):
    policy_key: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    policy_definition: dict[str, Any] | None = None


class PolicyDefinitionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    policy_definition: dict[str, Any] | None = None


class PolicyDefinitionStatusUpdateRequest(BaseModel):
    status: PolicyDefinitionStatus


def to_policy_definition_response(policy: PolicyDefinition) -> PolicyDefinitionResponse:
    return PolicyDefinitionResponse(
        id=policy.id,
        policy_key=policy.policy_key,
        status=policy.status,
        title=policy.title,
        description=policy.description,
        created_by=policy.created_by,
        created_at=policy.created_at,
        updated_at=policy.updated_at,
        approved_at=policy.approved_at,
        activated_at=policy.activated_at,
        retired_at=policy.retired_at,
        policy_definition=policy.policy_definition,
    )
