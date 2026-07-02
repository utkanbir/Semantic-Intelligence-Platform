"""REST API routes for the semantic_connectors module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.adapters.repositories.sqlalchemy_repository import (
    SqlAlchemyTechnologyAdapterRepository,
)
from app.modules.semantic_connectors.api.schemas import (
    SemanticConnectorCreateRequest,
    SemanticConnectorResponse,
    to_semantic_connector_response,
)
from app.modules.semantic_connectors.domain.enums import SemanticConnectorType
from app.modules.semantic_connectors.repositories.sqlalchemy_repository import (
    SqlAlchemySemanticConnectorRepository,
)
from app.modules.semantic_connectors.services.semantic_connectors_service import (
    DuplicateConnectorKeyError,
    InvalidSemanticConnectorBindingError,
    SemanticConnectorNotFoundError,
    SemanticConnectorsService,
    TechnologyAdapterNotFoundError,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


def _get_service(db: Session) -> SemanticConnectorsService:
    return SemanticConnectorsService(
        SqlAlchemySemanticConnectorRepository(db),
        SqlAlchemyTechnologyAdapterRepository(db),
    )


@router.post("", response_model=SemanticConnectorResponse, status_code=status.HTTP_201_CREATED)
def create_semantic_connector(
    payload: SemanticConnectorCreateRequest, db: DbSession
) -> SemanticConnectorResponse:
    service = _get_service(db)
    try:
        connector = service.create_connector(
            connector_key=payload.connector_key,
            connector_type=payload.connector_type,
            title=payload.title,
            technology_adapter_id=payload.technology_adapter_id,
            created_by=payload.created_by,
            description=payload.description,
            connector_configuration=payload.connector_configuration,
        )
    except DuplicateConnectorKeyError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except TechnologyAdapterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidSemanticConnectorBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_semantic_connector_response(connector)


@router.get("", response_model=list[SemanticConnectorResponse])
def list_semantic_connectors(
    db: DbSession,
    connector_type: Annotated[SemanticConnectorType | None, Query()] = None,
    active_only: Annotated[bool, Query()] = False,
) -> list[SemanticConnectorResponse]:
    service = _get_service(db)
    connectors = service.list_connectors(connector_type=connector_type, active_only=active_only)
    return [to_semantic_connector_response(item) for item in connectors]


@router.get("/{connector_id}", response_model=SemanticConnectorResponse)
def get_semantic_connector(connector_id: UUID, db: DbSession) -> SemanticConnectorResponse:
    service = _get_service(db)
    try:
        connector = service.get_connector(connector_id)
    except SemanticConnectorNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_semantic_connector_response(connector)
