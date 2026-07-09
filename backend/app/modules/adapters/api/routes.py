"""REST API routes for the adapters module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.adapters.api.schemas import (
    AdapterPingResponse,
    ConnectorProvisionResponse,
    ConnectorTestRequest,
    TechnologyAdapterCreateRequest,
    TechnologyAdapterResponse,
    TechnologyAdapterStatusUpdateRequest,
    TechnologyAdapterUpdateRequest,
    to_technology_adapter_response,
)
from app.modules.adapters.domain.enums import ConnectorType, TechnologyAdapterStatus
from app.modules.adapters.repositories.sqlalchemy_repository import (
    SqlAlchemyTechnologyAdapterRepository,
)
from app.modules.adapters.services.adapters_service import (
    UNSET,
    AdapterNotActiveError,
    AdaptersService,
    ConnectorConnectionTestError,
    ConnectorProvisionNotAllowedError,
    DuplicateAdapterKeyError,
    ImmutableTechnologyAdapterError,
    InvalidTechnologyAdapterStatusTransitionError,
    TechnologyAdapterNotFoundError,
    UnsupportedProvisionVendorError,
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

    def record_transaction_with_steps(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
        steps: Sequence[tuple[str, str | None]],
    ) -> None:
        self._repository.record_transaction_with_steps(
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
            application_id=None,
            steps=steps,
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
            technology_type=payload.connector_type,
            adapter_key=payload.connector_key,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            adapter_configuration=payload.connector_configuration,
        )
    except DuplicateAdapterKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except ConnectorConnectionTestError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_technology_adapter_response(adapter)


@router.post("/test", response_model=AdapterPingResponse)
def test_connector_configuration(
    payload: ConnectorTestRequest, db: DbSession
) -> AdapterPingResponse:
    service = _get_service(db)
    try:
        result = service.test_connector_configuration(
            technology_type=payload.connector_type,
            adapter_configuration=payload.connector_configuration,
        )
    except ConnectorConnectionTestError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return AdapterPingResponse(**result)


@router.get("", response_model=list[TechnologyAdapterResponse])
def list_adapters(
    db: DbSession,
    connector_type: Annotated[ConnectorType | None, Query()] = None,
    adapter_status: Annotated[TechnologyAdapterStatus | None, Query()] = None,
) -> list[TechnologyAdapterResponse]:
    service = _get_service(db)
    adapters = service.list_adapters(technology_type=connector_type, status=adapter_status)
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
            adapter_configuration=provided_values.get("connector_configuration", UNSET),
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
    except ConnectorConnectionTestError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return AdapterPingResponse(**result)


@router.post("/{adapter_id}/provision", response_model=ConnectorProvisionResponse)
def provision_connector(adapter_id: UUID, db: DbSession) -> ConnectorProvisionResponse:
    service = _get_service(db)
    try:
        result = service.provision_connector(adapter_id)
    except TechnologyAdapterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except (
        ConnectorProvisionNotAllowedError,
        UnsupportedProvisionVendorError,
        ConnectorConnectionTestError,
    ) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return ConnectorProvisionResponse(**result)
