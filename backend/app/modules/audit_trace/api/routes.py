"""REST API routes for the audit_trace module."""

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
def list_audit_traces_by_resource(
    db: DbSession,
    resource_id: Annotated[str, Query(min_length=1, max_length=255)],
) -> list[SemanticTransactionResponse]:
    service = _get_service(db)
    records = service.list_by_resource_id(resource_id)
    return [to_semantic_transaction_response(record) for record in records]


@router.get("/{transaction_id}", response_model=SemanticTransactionResponse)
def get_audit_trace(transaction_id: UUID, db: DbSession) -> SemanticTransactionResponse:
    service = _get_service(db)
    try:
        record = service.get_transaction(transaction_id)
    except SemanticTransactionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_semantic_transaction_response(record)
