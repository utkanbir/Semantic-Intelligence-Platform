"""REST API routes for the agents module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.agents.api.schemas import (
    AgentDefinitionCreateRequest,
    AgentDefinitionResponse,
    AgentDefinitionStatusUpdateRequest,
    AgentDefinitionUpdateRequest,
    AgentDefinitionVersionCreateRequest,
    to_agent_definition_response,
)
from app.modules.agents.domain.enums import AgentDefinitionStatus
from app.modules.agents.repositories.sqlalchemy_repository import (
    SqlAlchemyAgentDefinitionRepository,
)
from app.modules.agents.services.agents_service import (
    UNSET,
    AgentDefinitionNotFoundError,
    AgentsService,
    ApplicationNotFoundError,
    ImmutableAgentDefinitionError,
    InvalidAgentDefinitionStatusTransitionError,
    InvalidAgentDefinitionVersionForkError,
    InvalidProductBindingError,
    PublishedDataProductNotFoundError,
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
    """Adapter from agents TraceRecorder port to audit_trace repository."""

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


class SqlAlchemyConsumableProductReaderAdapter:
    """Adapter from agents ConsumableProductReader port to products repository."""

    def __init__(self, session: Session) -> None:
        self._repository = SqlAlchemyPublishedDataProductRepository(session)

    def get_consumable_status(self, product_id: UUID) -> str | None:
        product = self._repository.get(product_id)
        return product.status.value if product else None

    def get_application_id(self, product_id: UUID) -> UUID | None:
        product = self._repository.get(product_id)
        return product.application_id if product else None


def _get_service(db: Session) -> AgentsService:
    return AgentsService(
        SqlAlchemyAgentDefinitionRepository(db),
        SqlAlchemyApplicationRepository(db),
        SqlAlchemyConsumableProductReaderAdapter(db),
        SqlAlchemyTraceRecorderAdapter(db),
    )


@router.post("", response_model=AgentDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: AgentDefinitionCreateRequest, db: DbSession
) -> AgentDefinitionResponse:
    service = _get_service(db)
    try:
        agent = service.create_agent(
            application_id=payload.application_id,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            agent_definition=payload.agent_definition,
            bound_product_ids=payload.bound_product_ids,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PublishedDataProductNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidProductBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_agent_definition_response(agent)


@router.get("", response_model=list[AgentDefinitionResponse])
def list_agents(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
    agent_status: Annotated[AgentDefinitionStatus | None, Query()] = None,
) -> list[AgentDefinitionResponse]:
    service = _get_service(db)
    try:
        agents = service.list_agents(application_id=application_id, status=agent_status)
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_agent_definition_response(agent) for agent in agents]


@router.get("/{agent_id}", response_model=AgentDefinitionResponse)
def get_agent(agent_id: UUID, db: DbSession) -> AgentDefinitionResponse:
    service = _get_service(db)
    try:
        agent = service.get_agent(agent_id)
    except AgentDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_agent_definition_response(agent)


@router.patch("/{agent_id}", response_model=AgentDefinitionResponse)
def update_agent(
    agent_id: UUID, payload: AgentDefinitionUpdateRequest, db: DbSession
) -> AgentDefinitionResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        agent = service.update_agent(
            agent_id,
            title=provided_values.get("title"),
            description=provided_values.get("description", UNSET),
            agent_definition=provided_values.get("agent_definition", UNSET),
            bound_product_ids=provided_values.get("bound_product_ids", UNSET),
        )
    except AgentDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ImmutableAgentDefinitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except PublishedDataProductNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidProductBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_agent_definition_response(agent)


@router.patch("/{agent_id}/status", response_model=AgentDefinitionResponse)
def update_agent_status(
    agent_id: UUID, payload: AgentDefinitionStatusUpdateRequest, db: DbSession
) -> AgentDefinitionResponse:
    service = _get_service(db)
    try:
        agent = service.update_status(agent_id, status=payload.status)
    except AgentDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidAgentDefinitionStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except InvalidProductBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except PublishedDataProductNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_agent_definition_response(agent)


@router.post(
    "/{agent_id}/versions",
    response_model=AgentDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_agent_version(
    agent_id: UUID,
    payload: AgentDefinitionVersionCreateRequest,
    db: DbSession,
) -> AgentDefinitionResponse:
    service = _get_service(db)
    try:
        agent = service.create_version(
            agent_id,
            agent_definition=payload.agent_definition,
            bound_product_ids=payload.bound_product_ids,
        )
    except AgentDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidAgentDefinitionVersionForkError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except PublishedDataProductNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidProductBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_agent_definition_response(agent)
