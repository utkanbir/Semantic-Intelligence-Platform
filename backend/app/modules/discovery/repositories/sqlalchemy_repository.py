"""SQLAlchemy repository implementations for the discovery module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.discovery.domain.enums import DiscoverySessionStatus
from app.modules.discovery.domain.models import DiscoveryPhaseHistory, DiscoverySession
from app.modules.discovery.repositories.interfaces import (
    DiscoveryRepository,
    DiscoverySessionNotFoundError,
)
from app.modules.discovery.repositories.orm_models import (
    DiscoveryPhaseHistory as DiscoveryPhaseHistoryORM,
)
from app.modules.discovery.repositories.orm_models import (
    DiscoverySession as DiscoverySessionORM,
)


def _to_domain_phase_history(entry_orm: DiscoveryPhaseHistoryORM) -> DiscoveryPhaseHistory:
    return DiscoveryPhaseHistory(
        id=entry_orm.id,
        session_id=entry_orm.session_id,
        phase_number=entry_orm.phase_number,
        phase_name=entry_orm.phase_name,
        entered_at=entry_orm.entered_at,
        notes=entry_orm.notes,
    )


def _to_domain_session(session_orm: DiscoverySessionORM) -> DiscoverySession:
    return DiscoverySession(
        id=session_orm.id,
        application_id=session_orm.application_id,
        status=DiscoverySessionStatus(session_orm.status),
        title=session_orm.title,
        started_by=session_orm.started_by,
        started_at=session_orm.started_at,
        completed_at=session_orm.completed_at,
        intent_summary=session_orm.intent_summary,
        discovery_notes=session_orm.discovery_notes,
        recommendations=session_orm.recommendations,
        generated_blueprint_id=session_orm.generated_blueprint_id,
        conversation_history=session_orm.conversation_history,
        phase_history=[_to_domain_phase_history(entry) for entry in session_orm.phase_history],
    )


class SqlAlchemyDiscoveryRepository(DiscoveryRepository):
    """SQLAlchemy-backed implementation for discovery persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, discovery_session: DiscoverySession) -> DiscoverySession:
        session_orm = DiscoverySessionORM(
            id=discovery_session.id,
            application_id=discovery_session.application_id,
            status=discovery_session.status.value,
            title=discovery_session.title,
            started_by=discovery_session.started_by,
            started_at=discovery_session.started_at,
            completed_at=discovery_session.completed_at,
            intent_summary=discovery_session.intent_summary,
            discovery_notes=discovery_session.discovery_notes,
            recommendations=discovery_session.recommendations,
            generated_blueprint_id=discovery_session.generated_blueprint_id,
            conversation_history=discovery_session.conversation_history,
            phase_history=[
                DiscoveryPhaseHistoryORM(
                    id=entry.id,
                    session_id=discovery_session.id,
                    phase_number=entry.phase_number,
                    phase_name=entry.phase_name,
                    entered_at=entry.entered_at,
                    notes=entry.notes,
                )
                for entry in discovery_session.phase_history
            ],
        )
        self._session.add(session_orm)
        self._session.commit()
        self._session.refresh(session_orm)
        return _to_domain_session(session_orm)

    def list_by_application(self, application_id: UUID) -> Sequence[DiscoverySession]:
        statement = (
            select(DiscoverySessionORM)
            .options(selectinload(DiscoverySessionORM.phase_history))
            .where(DiscoverySessionORM.application_id == application_id)
            .order_by(DiscoverySessionORM.started_at.desc())
        )
        return [_to_domain_session(item) for item in self._session.scalars(statement).all()]

    def get(self, session_id: UUID) -> DiscoverySession | None:
        statement = (
            select(DiscoverySessionORM)
            .options(selectinload(DiscoverySessionORM.phase_history))
            .where(DiscoverySessionORM.id == session_id)
        )
        session_orm = self._session.scalars(statement).first()
        return _to_domain_session(session_orm) if session_orm else None

    def update(self, discovery_session: DiscoverySession) -> DiscoverySession | None:
        statement = (
            select(DiscoverySessionORM)
            .options(selectinload(DiscoverySessionORM.phase_history))
            .where(DiscoverySessionORM.id == discovery_session.id)
        )
        session_orm = self._session.scalars(statement).first()
        if session_orm is None:
            return None

        session_orm.status = discovery_session.status.value
        session_orm.title = discovery_session.title
        session_orm.completed_at = discovery_session.completed_at
        session_orm.intent_summary = discovery_session.intent_summary
        session_orm.discovery_notes = discovery_session.discovery_notes
        session_orm.recommendations = discovery_session.recommendations
        session_orm.generated_blueprint_id = discovery_session.generated_blueprint_id
        session_orm.conversation_history = discovery_session.conversation_history

        self._session.commit()
        self._session.refresh(session_orm)
        return _to_domain_session(session_orm)

    def append_phase_history(self, entry: DiscoveryPhaseHistory) -> DiscoveryPhaseHistory:
        session_orm = self._session.get(DiscoverySessionORM, entry.session_id)
        if session_orm is None:
            raise DiscoverySessionNotFoundError(f"Discovery session {entry.session_id} not found")

        entry_orm = DiscoveryPhaseHistoryORM(
            id=entry.id,
            session_id=entry.session_id,
            phase_number=entry.phase_number,
            phase_name=entry.phase_name,
            entered_at=entry.entered_at,
            notes=entry.notes,
        )
        self._session.add(entry_orm)
        self._session.commit()
        self._session.refresh(entry_orm)
        return _to_domain_phase_history(entry_orm)

    def list_phase_history(self, session_id: UUID) -> Sequence[DiscoveryPhaseHistory]:
        statement = (
            select(DiscoveryPhaseHistoryORM)
            .where(DiscoveryPhaseHistoryORM.session_id == session_id)
            .order_by(DiscoveryPhaseHistoryORM.entered_at.asc())
        )
        return [_to_domain_phase_history(item) for item in self._session.scalars(statement).all()]
