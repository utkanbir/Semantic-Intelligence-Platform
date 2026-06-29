"""REST API routes for the adapters module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.adapters.api.schemas import (
    AdapterPingResponse,
    TechnologyAdapterCreateRequest,
    TechnologyAdapterResponse,
    TechnologyAdapterStatusUpdateRequest,
    TechnologyAdapterUpdateRequest,
    to_technology_adapter_response,
)
from app.modules.adapters.domain.enums import TechnologyAdapterStatus, TechnologyType
from app.modules.adapters.repositories.sqlalchemy_repository import (
    SqlAlchemyTechnologyAdapterRepository,
)
from app.modules.adapters.services.adapters_service import (
    UNSET,
    AdapterNotActiveError,
    AdaptersService,
    DuplicateAdapterKeyError,
    ImmutableTechnologyAdapterError,
    InvalidTechnologyAdapterStatusTransitionError,
    TechnologyAdapterNotFoundError,
)
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
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


def _get_service(db: Session) -> AdaptersService:
    return AdaptersService(
        SqlAlchemyTechnologyAdapterRepository(db),
        SqlAlchemyTraceRecorderAdapter(db),
        session=db,
    )


@router.post("", response_model=TechnologyAdapterResponse, status_code=status.HTTP_201_CREATED)
def create_adapter(
    payload: TechnologyAdapterCreateRequest, db: DbSession
) -> TechnologyAdapterResponse:
    service = _get_service(db)
    try:
        adapter = service.create_adapter(
            technology_type=payload.technology_type,
            adapter_key=payload.adapter_key,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            adapter_configuration=payload.adapter_configuration,
        )
    except DuplicateAdapterKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_technology_adapter_response(adapter)


@router.get("", response_model=list[TechnologyAdapterResponse])
def list_adapters(
    db: DbSession,
    technology_type: Annotated[TechnologyType | None, Query()] = None,
    adapter_status: Annotated[TechnologyAdapterStatus | None, Query()] = None,
) -> list[TechnologyAdapterResponse]:
    service = _get_service(db)
    adapters = service.list_adapters(technology_type=technology_type, status=adapter_status)
    return [to_technology_adapter_response(item) for item in adapters]


@router.get("/{adapter_id}", response_model=TechnologyAdapterResponse)
def get_adapter(adapter_id: UUID, db: DbSession) -> TechnologyAdapterResponse:
    service = _get_service(db)
    try:
        adapter = service.get_adapter(adapter_id)
    except TechnologyAdapterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_technology_adapter_response(adapter)


@router.patch("/{adapter_id}", response_model=TechnologyAdapterResponse)
def update_adapter(
    adapter_id: UUID, payload: TechnologyAdapterUpdateRequest, db: DbSession
) -> TechnologyAdapterResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        adapter = service.update_adapter(
            adapter_id,
            title=provided_values.get("title"),
            description=provided_values.get("description", UNSET),
            adapter_configuration=provided_values.get("adapter_configuration", UNSET),
        )
    except TechnologyAdapterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ImmutableTechnologyAdapterError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_technology_adapter_response(adapter)


@router.patch("/{adapter_id}/status", response_model=TechnologyAdapterResponse)
def update_adapter_status(
    adapter_id: UUID, payload: TechnologyAdapterStatusUpdateRequest, db: DbSession
) -> TechnologyAdapterResponse:
    service = _get_service(db)
    try:
        adapter = service.update_status(adapter_id, status=payload.status)
    except TechnologyAdapterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidTechnologyAdapterStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_technology_adapter_response(adapter)


@router.post("/{adapter_id}/ping", response_model=AdapterPingResponse)
def ping_adapter(adapter_id: UUID, db: DbSession) -> AdapterPingResponse:
    service = _get_service(db)
    try:
        result = service.ping_adapter(adapter_id)
    except TechnologyAdapterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except AdapterNotActiveError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return AdapterPingResponse(**result)
