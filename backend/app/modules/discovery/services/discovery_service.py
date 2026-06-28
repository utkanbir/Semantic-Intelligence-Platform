"""Application services for the discovery module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.discovery.domain.enums import (
    DiscoveryPhaseNumber,
    DiscoverySessionStatus,
    phase_name_for_number,
)
from app.modules.discovery.domain.models import DiscoveryPhaseHistory, DiscoverySession
from app.modules.discovery.repositories.interfaces import DiscoveryRepository

UNSET = object()


class ApplicationNotFoundError(Exception):
    """Raised when the parent application does not exist."""


class DiscoverySessionNotFoundError(Exception):
    """Raised when a discovery session cannot be found."""


class InvalidDiscoverySessionStatusTransitionError(Exception):
    """Raised when a discovery session status transition is not allowed."""


class InvalidDiscoveryPhaseAdvanceError(Exception):
    """Raised when a discovery phase cannot be advanced."""


class DiscoveryService:
    """Discovery session CRUD orchestration."""

    def __init__(
        self,
        repository: DiscoveryRepository,
        application_repository: ApplicationRepository,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository

    def create_session(
        self,
        *,
        application_id: UUID,
        title: str,
        started_by: str | None = None,
    ) -> DiscoverySession:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        now = datetime.now(UTC)
        session_id = uuid4()
        phase_number = int(DiscoveryPhaseNumber.INTENT_DISCOVERY)
        discovery_session = DiscoverySession(
            id=session_id,
            application_id=application_id,
            status=DiscoverySessionStatus.ACTIVE,
            title=title,
            started_by=started_by or "",
            started_at=now,
            recommendations=[],
            conversation_history=[],
            phase_history=[
                DiscoveryPhaseHistory(
                    id=uuid4(),
                    session_id=session_id,
                    phase_number=phase_number,
                    phase_name=phase_name_for_number(phase_number),
                    entered_at=now,
                )
            ],
        )
        return self._repository.create(discovery_session)

    def list_sessions(self, *, application_id: UUID) -> list[DiscoverySession]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        return list(self._repository.list_by_application(application_id))

    def get_session(self, session_id: UUID) -> DiscoverySession:
        session = self._repository.get(session_id)
        if session is None:
            raise DiscoverySessionNotFoundError("Discovery session not found")
        return session

    def update_session(
        self,
        session_id: UUID,
        *,
        title: str | None = None,
        intent_summary: str | None | object = UNSET,
        discovery_notes: str | None | object = UNSET,
        recommendations: list[Any] | None | object = UNSET,
        conversation_history: list[Any] | None | object = UNSET,
    ) -> DiscoverySession:
        current = self._repository.get(session_id)
        if current is None:
            raise DiscoverySessionNotFoundError("Discovery session not found")

        updated = DiscoverySession(
            id=current.id,
            application_id=current.application_id,
            status=current.status,
            title=title if title is not None else current.title,
            started_by=current.started_by,
            started_at=current.started_at,
            completed_at=current.completed_at,
            intent_summary=(
                current.intent_summary
                if intent_summary is UNSET
                else cast(str | None, intent_summary)
            ),
            discovery_notes=(
                current.discovery_notes
                if discovery_notes is UNSET
                else cast(str | None, discovery_notes)
            ),
            recommendations=(
                current.recommendations
                if recommendations is UNSET
                else cast(list[Any] | None, recommendations)
            ),
            generated_blueprint_id=current.generated_blueprint_id,
            conversation_history=(
                current.conversation_history
                if conversation_history is UNSET
                else cast(list[Any] | None, conversation_history)
            ),
            phase_history=current.phase_history,
        )
        result = self._repository.update(updated)
        if result is None:
            raise DiscoverySessionNotFoundError("Discovery session not found")
        return result

    def update_status(
        self, session_id: UUID, *, status: DiscoverySessionStatus
    ) -> DiscoverySession:
        current = self._repository.get(session_id)
        if current is None:
            raise DiscoverySessionNotFoundError("Discovery session not found")
        if current.status == DiscoverySessionStatus.ARCHIVED:
            raise InvalidDiscoverySessionStatusTransitionError(
                "Archived discovery sessions cannot be modified"
            )
        if not _is_valid_status_transition(current.status, status):
            raise InvalidDiscoverySessionStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        completed_at = current.completed_at
        if status == DiscoverySessionStatus.COMPLETED and completed_at is None:
            completed_at = datetime.now(UTC)

        updated = DiscoverySession(
            id=current.id,
            application_id=current.application_id,
            status=status,
            title=current.title,
            started_by=current.started_by,
            started_at=current.started_at,
            completed_at=completed_at,
            intent_summary=current.intent_summary,
            discovery_notes=current.discovery_notes,
            recommendations=current.recommendations,
            generated_blueprint_id=current.generated_blueprint_id,
            conversation_history=current.conversation_history,
            phase_history=current.phase_history,
        )
        result = self._repository.update(updated)
        if result is None:
            raise DiscoverySessionNotFoundError("Discovery session not found")
        return result

    def list_phase_history(self, session_id: UUID) -> list[DiscoveryPhaseHistory]:
        if self._repository.get(session_id) is None:
            raise DiscoverySessionNotFoundError("Discovery session not found")
        return list(self._repository.list_phase_history(session_id))

    def advance_phase(self, session_id: UUID, *, notes: str | None = None) -> DiscoverySession:
        current = self._repository.get(session_id)
        if current is None:
            raise DiscoverySessionNotFoundError("Discovery session not found")
        if current.status != DiscoverySessionStatus.ACTIVE:
            raise InvalidDiscoveryPhaseAdvanceError(
                "Phase advance is only allowed when session status is Active"
            )

        current_phase = current.current_phase
        if current_phase is None:
            raise InvalidDiscoveryPhaseAdvanceError("Discovery session has no phase history")
        if current_phase.phase_number >= int(DiscoveryPhaseNumber.APPLICATION_EVOLUTION):
            raise InvalidDiscoveryPhaseAdvanceError("Cannot advance past phase 10")

        next_phase_number = current_phase.phase_number + 1
        self._repository.append_phase_history(
            DiscoveryPhaseHistory(
                id=uuid4(),
                session_id=session_id,
                phase_number=next_phase_number,
                phase_name=phase_name_for_number(next_phase_number),
                entered_at=datetime.now(UTC),
                notes=notes,
            )
        )
        refreshed = self._repository.get(session_id)
        if refreshed is None:
            raise DiscoverySessionNotFoundError("Discovery session not found")
        return refreshed


VALID_STATUS_TRANSITIONS: dict[DiscoverySessionStatus, set[DiscoverySessionStatus]] = {
    DiscoverySessionStatus.ACTIVE: {
        DiscoverySessionStatus.PAUSED,
        DiscoverySessionStatus.COMPLETED,
        DiscoverySessionStatus.ARCHIVED,
    },
    DiscoverySessionStatus.PAUSED: {
        DiscoverySessionStatus.ACTIVE,
        DiscoverySessionStatus.COMPLETED,
        DiscoverySessionStatus.ARCHIVED,
    },
    DiscoverySessionStatus.COMPLETED: {DiscoverySessionStatus.ARCHIVED},
    DiscoverySessionStatus.ARCHIVED: set(),
}


def _is_valid_status_transition(
    current: DiscoverySessionStatus, target: DiscoverySessionStatus
) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]
