"""REST API routes for the governance module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
)
from app.modules.governance.api.schemas import (
    PolicyDefinitionCreateRequest,
    PolicyDefinitionResponse,
    PolicyDefinitionStatusUpdateRequest,
    PolicyDefinitionUpdateRequest,
    to_policy_definition_response,
)
from app.modules.governance.domain.enums import PolicyDefinitionStatus
from app.modules.governance.repositories.sqlalchemy_repository import (
    SqlAlchemyPolicyDefinitionRepository,
)
from app.modules.governance.services.governance_service import (
    UNSET,
    DuplicatePolicyKeyError,
    GovernanceService,
    ImmutablePolicyDefinitionError,
    InvalidPolicyDefinitionStatusTransitionError,
    PolicyDefinitionNotFoundError,
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


def _get_service(db: Session) -> GovernanceService:
    return GovernanceService(
        SqlAlchemyPolicyDefinitionRepository(db),
        SqlAlchemyTraceRecorderAdapter(db),
    )


@router.post("", response_model=PolicyDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_policy(
    payload: PolicyDefinitionCreateRequest, db: DbSession
) -> PolicyDefinitionResponse:
    service = _get_service(db)
    try:
        policy = service.create_policy(
            policy_key=payload.policy_key,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            policy_definition=payload.policy_definition,
        )
    except DuplicatePolicyKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_policy_definition_response(policy)


@router.get("", response_model=list[PolicyDefinitionResponse])
def list_policies(
    db: DbSession,
    policy_status: Annotated[PolicyDefinitionStatus | None, Query()] = None,
) -> list[PolicyDefinitionResponse]:
    service = _get_service(db)
    policies = service.list_policies(status=policy_status)
    return [to_policy_definition_response(item) for item in policies]


@router.get("/{policy_id}", response_model=PolicyDefinitionResponse)
def get_policy(policy_id: UUID, db: DbSession) -> PolicyDefinitionResponse:
    service = _get_service(db)
    try:
        policy = service.get_policy(policy_id)
    except PolicyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_policy_definition_response(policy)


@router.patch("/{policy_id}", response_model=PolicyDefinitionResponse)
def update_policy(
    policy_id: UUID, payload: PolicyDefinitionUpdateRequest, db: DbSession
) -> PolicyDefinitionResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        policy = service.update_policy(
            policy_id,
            title=provided_values.get("title"),
            description=provided_values.get("description", UNSET),
            policy_definition=provided_values.get("policy_definition", UNSET),
        )
    except PolicyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ImmutablePolicyDefinitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_policy_definition_response(policy)


@router.patch("/{policy_id}/status", response_model=PolicyDefinitionResponse)
def update_policy_status(
    policy_id: UUID, payload: PolicyDefinitionStatusUpdateRequest, db: DbSession
) -> PolicyDefinitionResponse:
    service = _get_service(db)
    try:
        policy = service.update_status(policy_id, status=payload.status)
    except PolicyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidPolicyDefinitionStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_policy_definition_response(policy)
