"""REST API routes for the discovery module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.discovery.api.schemas import (
    DiscoverySessionCreateRequest,
    DiscoverySessionResponse,
    DiscoverySessionUpdateRequest,
    to_discovery_session_response,
)
from app.modules.discovery.repositories.sqlalchemy_repository import SqlAlchemyDiscoveryRepository
from app.modules.discovery.services.discovery_service import (
    UNSET,
    ApplicationNotFoundError,
    DiscoveryService,
    DiscoverySessionNotFoundError,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


def _get_service(db: Session) -> DiscoveryService:
    return DiscoveryService(
        SqlAlchemyDiscoveryRepository(db),
        SqlAlchemyApplicationRepository(db),
    )


@router.post("", response_model=DiscoverySessionResponse, status_code=status.HTTP_201_CREATED)
def create_discovery_session(
    payload: DiscoverySessionCreateRequest, db: DbSession
) -> DiscoverySessionResponse:
    service = _get_service(db)
    try:
        session = service.create_session(
            application_id=payload.application_id,
            title=payload.title,
            started_by=payload.started_by,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_discovery_session_response(session)


@router.get("", response_model=list[DiscoverySessionResponse])
def list_discovery_sessions(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
) -> list[DiscoverySessionResponse]:
    service = _get_service(db)
    try:
        sessions = service.list_sessions(application_id=application_id)
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_discovery_session_response(session) for session in sessions]


@router.get("/{session_id}", response_model=DiscoverySessionResponse)
def get_discovery_session(session_id: UUID, db: DbSession) -> DiscoverySessionResponse:
    service = _get_service(db)
    try:
        session = service.get_session(session_id)
    except DiscoverySessionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_discovery_session_response(session)


@router.patch("/{session_id}", response_model=DiscoverySessionResponse)
def update_discovery_session(
    session_id: UUID, payload: DiscoverySessionUpdateRequest, db: DbSession
) -> DiscoverySessionResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        session = service.update_session(
            session_id,
            title=provided_values.get("title"),
            intent_summary=provided_values.get("intent_summary", UNSET),
            discovery_notes=provided_values.get("discovery_notes", UNSET),
            recommendations=provided_values.get("recommendations", UNSET),
            conversation_history=provided_values.get("conversation_history", UNSET),
        )
    except DiscoverySessionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_discovery_session_response(session)
