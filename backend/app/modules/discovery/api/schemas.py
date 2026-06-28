"""Pydantic request/response schemas for the discovery module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.discovery.domain.enums import DiscoverySessionStatus
from app.modules.discovery.domain.models import DiscoverySession


class CurrentPhaseResponse(BaseModel):
    """Derived current phase from latest history entry."""

    phase_number: int
    phase_name: str


class DiscoveryPhaseHistoryResponse(BaseModel):
    """Phase history entry response."""

    id: UUID
    session_id: UUID
    phase_number: int
    phase_name: str
    entered_at: datetime
    notes: str | None = None


class DiscoverySessionResponse(BaseModel):
    """Discovery session response payload."""

    id: UUID
    application_id: UUID
    status: DiscoverySessionStatus
    title: str
    started_by: str
    started_at: datetime
    completed_at: datetime | None = None
    intent_summary: str | None = None
    discovery_notes: str | None = None
    recommendations: list[Any] | None = None
    generated_blueprint_id: UUID | None = None
    conversation_history: list[Any] | None = None
    current_phase: CurrentPhaseResponse | None = None
    phase_history: list[DiscoveryPhaseHistoryResponse] = Field(default_factory=list)


class DiscoverySessionCreateRequest(BaseModel):
    """Discovery session creation request."""

    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    started_by: str | None = Field(default=None, max_length=255)


class DiscoverySessionUpdateRequest(BaseModel):
    """Discovery session update request."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    intent_summary: str | None = None
    discovery_notes: str | None = None
    recommendations: list[Any] | None = None
    conversation_history: list[Any] | None = None


class DiscoverySessionStatusUpdateRequest(BaseModel):
    """Discovery session status update request."""

    status: DiscoverySessionStatus


def to_discovery_session_response(session: DiscoverySession) -> DiscoverySessionResponse:
    """Map domain model to API response schema."""
    current_phase = session.current_phase
    return DiscoverySessionResponse(
        id=session.id,
        application_id=session.application_id,
        status=session.status,
        title=session.title,
        started_by=session.started_by,
        started_at=session.started_at,
        completed_at=session.completed_at,
        intent_summary=session.intent_summary,
        discovery_notes=session.discovery_notes,
        recommendations=session.recommendations or [],
        generated_blueprint_id=session.generated_blueprint_id,
        conversation_history=session.conversation_history or [],
        current_phase=(
            CurrentPhaseResponse(
                phase_number=current_phase.phase_number,
                phase_name=current_phase.phase_name,
            )
            if current_phase is not None
            else None
        ),
        phase_history=[
            DiscoveryPhaseHistoryResponse(
                id=entry.id,
                session_id=entry.session_id,
                phase_number=entry.phase_number,
                phase_name=entry.phase_name,
                entered_at=entry.entered_at,
                notes=entry.notes,
            )
            for entry in sorted(session.phase_history, key=lambda item: item.entered_at)
        ],
    )
