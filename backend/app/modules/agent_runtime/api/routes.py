"""REST API routes for the agent_runtime module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.agent_runtime.api.schemas import (
    AgentRunCreateRequest,
    AgentRunResponse,
    to_agent_run_response,
)
from app.modules.agent_runtime.domain.enums import AgentRunStatus
from app.modules.agent_runtime.repositories.sqlalchemy_repository import (
    SqlAlchemyAgentRunRepository,
)
from app.modules.agent_runtime.services.agent_runtime_service import (
    AgentDefinitionNotFoundError,
    AgentNotExecutableError,
    AgentRunNotFoundError,
    AgentRuntimeService,
    ApplicationNotFoundError,
    InvalidProductBindingError,
    PublishedDataProductNotFoundError,
)
from app.modules.agents.repositories.sqlalchemy_repository import (
    SqlAlchemyAgentDefinitionRepository,
)
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
)
from app.modules.products.repositories.sqlalchemy_repository import (
    SqlAlchemyPublishedDataProductRepository,
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


class SqlAlchemyExecutableAgentReaderAdapter:
    def __init__(self, session: Session) -> None:
        self._repository = SqlAlchemyAgentDefinitionRepository(session)

    def get_agent_status(self, agent_id: UUID) -> str | None:
        agent = self._repository.get(agent_id)
        return agent.status.value if agent else None

    def get_application_id(self, agent_id: UUID) -> UUID | None:
        agent = self._repository.get(agent_id)
        return agent.application_id if agent else None

    def get_bound_product_ids(self, agent_id: UUID) -> list[str] | None:
        agent = self._repository.get(agent_id)
        return list(agent.bound_product_ids) if agent else None


class SqlAlchemyConsumableProductReaderAdapter:
    def __init__(self, session: Session) -> None:
        self._repository = SqlAlchemyPublishedDataProductRepository(session)

    def get_consumable_status(self, product_id: UUID) -> str | None:
        product = self._repository.get(product_id)
        return product.status.value if product else None

    def get_application_id(self, product_id: UUID) -> UUID | None:
        product = self._repository.get(product_id)
        return product.application_id if product else None


def _get_service(db: Session) -> AgentRuntimeService:
    return AgentRuntimeService(
        SqlAlchemyAgentRunRepository(db),
        SqlAlchemyApplicationRepository(db),
        SqlAlchemyExecutableAgentReaderAdapter(db),
        SqlAlchemyConsumableProductReaderAdapter(db),
        SqlAlchemyTraceRecorderAdapter(db),
    )


@router.post("", response_model=AgentRunResponse, status_code=status.HTTP_201_CREATED)
def start_agent_run(payload: AgentRunCreateRequest, db: DbSession) -> AgentRunResponse:
    service = _get_service(db)
    try:
        run = service.start_run(
            application_id=payload.application_id,
            agent_definition_id=payload.agent_definition_id,
            created_by=payload.created_by,
            run_payload=payload.run_payload,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except AgentDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PublishedDataProductNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except AgentNotExecutableError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except InvalidProductBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_agent_run_response(run)


@router.get("", response_model=list[AgentRunResponse])
def list_agent_runs(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
    run_status: Annotated[AgentRunStatus | None, Query()] = None,
) -> list[AgentRunResponse]:
    service = _get_service(db)
    try:
        runs = service.list_runs(application_id=application_id, status=run_status)
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_agent_run_response(item) for item in runs]


@router.get("/{run_id}", response_model=AgentRunResponse)
def get_agent_run(run_id: UUID, db: DbSession) -> AgentRunResponse:
    service = _get_service(db)
    try:
        run = service.get_run(run_id)
    except AgentRunNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_agent_run_response(run)
