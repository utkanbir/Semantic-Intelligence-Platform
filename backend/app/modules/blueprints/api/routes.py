"""REST API routes for the blueprints module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.blueprints.api.schemas import (
    BlueprintCreateRequest,
    BlueprintResponse,
    BlueprintStatusUpdateRequest,
    BlueprintUpdateRequest,
    to_blueprint_response,
)
from app.modules.blueprints.repositories.sqlalchemy_repository import (
    SqlAlchemyBlueprintRepository,
)
from app.modules.blueprints.services.blueprints_service import (
    UNSET,
    ApplicationNotFoundError,
    BlueprintNotFoundError,
    BlueprintsService,
    ImmutableBlueprintError,
    InvalidBlueprintStatusTransitionError,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


def _get_service(db: Session) -> BlueprintsService:
    return BlueprintsService(
        SqlAlchemyBlueprintRepository(db),
        SqlAlchemyApplicationRepository(db),
    )


@router.post("", response_model=BlueprintResponse, status_code=status.HTTP_201_CREATED)
def create_blueprint(payload: BlueprintCreateRequest, db: DbSession) -> BlueprintResponse:
    service = _get_service(db)
    try:
        blueprint = service.create_blueprint(
            application_id=payload.application_id,
            title=payload.title,
            created_by=payload.created_by,
            goal=payload.goal,
            outcome=payload.outcome,
            blueprint_snapshot=payload.blueprint_snapshot,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_blueprint_response(blueprint)


@router.get("", response_model=list[BlueprintResponse])
def list_blueprints(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
) -> list[BlueprintResponse]:
    service = _get_service(db)
    try:
        blueprints = service.list_blueprints(application_id=application_id)
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_blueprint_response(blueprint) for blueprint in blueprints]


@router.get("/{blueprint_id}", response_model=BlueprintResponse)
def get_blueprint(blueprint_id: UUID, db: DbSession) -> BlueprintResponse:
    service = _get_service(db)
    try:
        blueprint = service.get_blueprint(blueprint_id)
    except BlueprintNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_blueprint_response(blueprint)


@router.patch("/{blueprint_id}", response_model=BlueprintResponse)
def update_blueprint(
    blueprint_id: UUID, payload: BlueprintUpdateRequest, db: DbSession
) -> BlueprintResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        blueprint = service.update_blueprint(
            blueprint_id,
            title=provided_values.get("title"),
            goal=provided_values.get("goal", UNSET),
            outcome=provided_values.get("outcome", UNSET),
            blueprint_snapshot=provided_values.get("blueprint_snapshot", UNSET),
        )
    except BlueprintNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ImmutableBlueprintError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_blueprint_response(blueprint)


@router.patch("/{blueprint_id}/status", response_model=BlueprintResponse)
def update_blueprint_status(
    blueprint_id: UUID, payload: BlueprintStatusUpdateRequest, db: DbSession
) -> BlueprintResponse:
    service = _get_service(db)
    try:
        blueprint = service.update_status(blueprint_id, status=payload.status)
    except BlueprintNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidBlueprintStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_blueprint_response(blueprint)
