"""REST API routes for the applications module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.applications.api.schemas import (
    ApplicationCreateRequest,
    ApplicationResponse,
    ApplicationStatusUpdateRequest,
    ApplicationUpdateRequest,
    to_application_response,
)
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.applications.services.applications_service import (
    UNSET,
    ApplicationConflictError,
    ApplicationNotFoundError,
    ApplicationsService,
    InvalidApplicationStatusTransitionError,
)
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


class SqlAlchemyTraceRecorderAdapter:
    """Adapter from applications TraceRecorder port to audit_trace repository."""

    def __init__(self, session: Session) -> None:
        self._repository = SqlAlchemyAuditTraceRepository(session)

    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        self._repository.record_transaction(
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
        )


def _get_service(db: Session) -> ApplicationsService:
    return ApplicationsService(
        SqlAlchemyApplicationRepository(db),
        SqlAlchemyTraceRecorderAdapter(db),
    )


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(payload: ApplicationCreateRequest, db: DbSession) -> ApplicationResponse:
    service = _get_service(db)
    try:
        application = service.create_application(
            key=payload.key,
            name=payload.name,
            description=payload.description,
        )
    except ApplicationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_application_response(application)


@router.get("", response_model=list[ApplicationResponse])
def list_applications(db: DbSession) -> list[ApplicationResponse]:
    service = _get_service(db)
    applications = service.list_applications()
    return [to_application_response(application) for application in applications]


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: UUID, db: DbSession) -> ApplicationResponse:
    service = _get_service(db)
    try:
        application = service.get_application(application_id)
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_application_response(application)


@router.put("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: UUID, payload: ApplicationUpdateRequest, db: DbSession
) -> ApplicationResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        application = service.update_application(
            application_id,
            key=provided_values.get("key"),
            name=provided_values.get("name"),
            description=provided_values.get("description", UNSET),
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ApplicationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_application_response(application)


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
def update_application_status(
    application_id: UUID, payload: ApplicationStatusUpdateRequest, db: DbSession
) -> ApplicationResponse:
    service = _get_service(db)
    try:
        application = service.update_status(application_id, status=payload.status)
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidApplicationStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_application_response(application)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: UUID, db: DbSession) -> Response:
    service = _get_service(db)
    try:
        service.delete_application(application_id)
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
