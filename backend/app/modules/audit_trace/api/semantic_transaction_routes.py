"""REST API routes for semantic lineage transactions."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.audit_trace.api.schemas import (
    SemanticTransactionResponse,
    to_semantic_transaction_response,
)
from app.modules.audit_trace.domain.trace_audience import TraceAudience
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceQueryRepository,
)
from app.modules.audit_trace.services.audit_trace_service import (
    AuditTraceService,
    SemanticTransactionNotFoundError,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


def _get_service(db: Session) -> AuditTraceService:
    return AuditTraceService(SqlAlchemyAuditTraceQueryRepository(db))


@router.get("", response_model=list[SemanticTransactionResponse])
def list_semantic_transactions(
    db: DbSession,
    resource_id: Annotated[str | None, Query(min_length=1, max_length=255)] = None,
    application_id: Annotated[UUID | None, Query()] = None,
    resource_type: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> list[SemanticTransactionResponse]:
    if resource_id is not None and application_id is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide resource_id or application_id, not both",
        )

    service = _get_service(db)
    records = service.list_transactions(
        resource_id=resource_id,
        application_id=application_id,
        resource_type=resource_type,
        trace_audience=TraceAudience.SEMANTIC_LINEAGE,
        limit=limit,
    )
    return [to_semantic_transaction_response(record) for record in records]


@router.get("/{transaction_id}", response_model=SemanticTransactionResponse)
def get_semantic_transaction(
    transaction_id: UUID, db: DbSession
) -> SemanticTransactionResponse:
    service = _get_service(db)
    try:
        record = service.get_semantic_lineage_transaction(transaction_id)
    except SemanticTransactionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_semantic_transaction_response(record)
