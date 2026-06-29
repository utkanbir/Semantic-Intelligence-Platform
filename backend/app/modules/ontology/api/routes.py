"""REST API routes for the ontology module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
)
from app.modules.ontology.api.schemas import (
    OntologyDefinitionCreateRequest,
    OntologyDefinitionResponse,
    OntologyDefinitionStatusUpdateRequest,
    OntologyDefinitionUpdateRequest,
    OntologyDefinitionVersionCreateRequest,
    to_ontology_definition_response,
)
from app.modules.ontology.domain.enums import OntologyDefinitionStatus
from app.modules.ontology.repositories.sqlalchemy_repository import (
    SqlAlchemyOntologyDefinitionRepository,
)
from app.modules.ontology.services.ontology_service import (
    UNSET,
    ApplicationNotFoundError,
    ImmutableOntologyDefinitionError,
    InvalidOntologyDefinitionStatusTransitionError,
    InvalidOntologyDefinitionVersionForkError,
    OntologyDefinitionNotFoundError,
    OntologyService,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


class SqlAlchemyTraceRecorderAdapter:
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


def _get_service(db: Session) -> OntologyService:
    return OntologyService(
        SqlAlchemyOntologyDefinitionRepository(db),
        SqlAlchemyApplicationRepository(db),
        SqlAlchemyTraceRecorderAdapter(db),
    )


@router.post("", response_model=OntologyDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_ontology(
    payload: OntologyDefinitionCreateRequest, db: DbSession
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology = service.create_ontology(
            application_id=payload.application_id,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            ontology_definition=payload.ontology_definition,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_ontology_definition_response(ontology)


@router.get("", response_model=list[OntologyDefinitionResponse])
def list_ontologies(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
    ontology_status: Annotated[OntologyDefinitionStatus | None, Query()] = None,
) -> list[OntologyDefinitionResponse]:
    service = _get_service(db)
    try:
        ontologies = service.list_ontologies(
            application_id=application_id, status=ontology_status
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_ontology_definition_response(item) for item in ontologies]


@router.get("/{ontology_id}", response_model=OntologyDefinitionResponse)
def get_ontology(ontology_id: UUID, db: DbSession) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology = service.get_ontology(ontology_id)
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_ontology_definition_response(ontology)


@router.patch("/{ontology_id}", response_model=OntologyDefinitionResponse)
def update_ontology(
    ontology_id: UUID, payload: OntologyDefinitionUpdateRequest, db: DbSession
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        ontology = service.update_ontology(
            ontology_id,
            title=provided_values.get("title"),
            description=provided_values.get("description", UNSET),
            ontology_definition=provided_values.get("ontology_definition", UNSET),
        )
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ImmutableOntologyDefinitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_ontology_definition_response(ontology)


@router.patch("/{ontology_id}/status", response_model=OntologyDefinitionResponse)
def update_ontology_status(
    ontology_id: UUID, payload: OntologyDefinitionStatusUpdateRequest, db: DbSession
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology = service.update_status(ontology_id, status=payload.status)
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidOntologyDefinitionStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_ontology_definition_response(ontology)


@router.post(
    "/{ontology_id}/versions",
    response_model=OntologyDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_ontology_version(
    ontology_id: UUID,
    payload: OntologyDefinitionVersionCreateRequest,
    db: DbSession,
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology = service.create_version(
            ontology_id,
            ontology_definition=payload.ontology_definition,
        )
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidOntologyDefinitionVersionForkError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_ontology_definition_response(ontology)
